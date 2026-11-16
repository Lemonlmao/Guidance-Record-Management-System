package guidance;

import com.sun.net.httpserver.HttpExchange;
import java.sql.SQLException;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/** Opaque server-side sessions. Cookies never contain passwords, account data, or CSRF tokens. */
public final class AuthService {
    static final long IDLE_MILLIS=Duration.ofMinutes(15).toMillis();
    static final long ABSOLUTE_MILLIS=Duration.ofHours(8).toMillis();
    private static final long ATTEMPT_WINDOW=Duration.ofMinutes(15).toMillis();
    private final Map<String,Session> sessions=new ConcurrentHashMap<>();
    private final Deque<Long> attempts=new ArrayDeque<>();
    private final Database database;
    private final LongSupplier clock;
    private final String cookieName;

    public static final class Session {
        final String id=Passwords.token(),csrf=Passwords.token();
        final Database.Account account;
        final long created;
        volatile long used;
        Session(Database.Account account,long now) { this.account=account;created=used=now; }
    }
    public AuthService(Database database,int port) { this(database,port,System::currentTimeMillis); }
    AuthService(Database database,int port,LongSupplier clock) { this.database=database;this.clock=clock;cookieName="guidancedesk_session_"+port; }

    Session createSession(Database.Account account) {
        long now=clock.getAsLong();sessions.entrySet().removeIf(entry->expired(entry.getValue(),now));
        if(sessions.size()>=256) throw new SecurityProblem(429,"Too many local sessions. Close unused tabs and try again in 15 minutes.");
        Session session=new Session(account,now);sessions.put(session.id,session);return session;
    }
    Session find(String id,boolean touch) {
        Session session=id==null?null:sessions.get(id);long now=clock.getAsLong();
        if(session!=null&&expired(session,now)) { sessions.remove(id);return null; }
        if(session!=null&&touch) session.used=now;
        return session;
    }
    private boolean expired(Session session,long now) { return now-session.used>=IDLE_MILLIS||now-session.created>=ABSOLUTE_MILLIS; }
    private Session resolve(HttpExchange exchange,boolean touch) {
        String raw=exchange.getRequestHeaders().getFirst("Cookie");
        if(raw!=null) for(String part:raw.split(";")) {
            String[] pair=part.trim().split("=",2);
            if(pair.length==2&&pair[0].equals(cookieName)&&pair[1].matches("[A-Za-z0-9_-]{43}")) return find(pair[1],touch);
        }
        return null;
    }
    private void issueCookie(HttpExchange exchange,Session session) {
        // Deliberately loopback HTTP only. Public hosting requires HTTPS and a Secure cookie.
        exchange.getResponseHeaders().set("Set-Cookie",cookieName+"="+session.id+"; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800");
    }
    public Session bootstrap(HttpExchange exchange) {
        Session session=resolve(exchange,false);
        if(session==null) { session=createSession(null);issueCookie(exchange,session); }
        return session;
    }
    public Session requireSession(HttpExchange exchange,boolean authenticated) {
        Session session=resolve(exchange,authenticated);
        if(session==null||(authenticated&&session.account==null)) throw new SecurityProblem(401,"Your session has ended. Sign in again to continue.");
        return session;
    }
    public void requireCsrf(HttpExchange exchange,Session session) {
        if(!Passwords.equalTokens(exchange.getRequestHeaders().getFirst("X-Guidance-Token"),session.csrf)) throw new SecurityProblem(403,"This request could not be verified. Refresh this tab and try again.");
    }
    public Map<String,Object> describe(Session session) throws SQLException {
        Map<String,Object> info=new LinkedHashMap<>();
        info.put("configured",database.hasAccount());info.put("authenticated",session.account!=null);info.put("csrf_token",session.csrf);
        info.put("expires_in_seconds",Math.max(0,Math.min(IDLE_MILLIS-(clock.getAsLong()-session.used),ABSOLUTE_MILLIS-(clock.getAsLong()-session.created)))/1000);
        if(session.account!=null) info.put("account",session.account.publicInfo());
        return info;
    }
    synchronized void reserveAttempt() {
        long now=clock.getAsLong();while(!attempts.isEmpty()&&attempts.peekFirst()<=now-ATTEMPT_WINDOW) attempts.removeFirst();
        if(attempts.size()>=5) throw new SecurityProblem(429,"Too many sign-in attempts. Wait 15 minutes before trying again.");
        attempts.addLast(now);
    }
    private synchronized void clearAttempts() { attempts.clear(); }
    public Session login(HttpExchange exchange,Session previous,Map<String,String> form) throws SQLException {
        reserveAttempt();
        String username=form.getOrDefault("username","").trim(),password=form.getOrDefault("password","");
        Database.Account account=database.authenticate(username.length()>40?"invalid":username,password);
        if(account==null) { database.auditEvent("anonymous","LOGIN_FAILED");throw new SecurityProblem(401,"The username or passphrase is incorrect."); }
        clearAttempts();database.auditEvent(account.username(),"LOGIN_SUCCEEDED");
        sessions.remove(previous.id);Session session=createSession(account);issueCookie(exchange,session);return session;
    }
    public Session setup(HttpExchange exchange,Session previous,Map<String,String> form) throws SQLException {
        database.apply(null,"/api/auth/setup",form);return login(exchange,previous,form);
    }
    public Session logout(HttpExchange exchange,Session previous) throws SQLException {
        database.auditEvent(previous.account.username(),"LOGOUT");sessions.remove(previous.id);
        Session session=createSession(null);issueCookie(exchange,session);return session;
    }
    public Session changePassword(HttpExchange exchange,Session previous,Map<String,String> form) throws SQLException {
        reserveAttempt();database.apply(previous.account,"/api/auth/password",form);clearAttempts();sessions.clear();
        Session session=createSession(null);issueCookie(exchange,session);return session;
    }
}
