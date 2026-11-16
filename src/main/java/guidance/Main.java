package guidance;

import com.sun.net.httpserver.*;
import java.awt.Desktop;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.SQLException;
import java.util.*;
import java.util.concurrent.Executors;

/** A loopback-only Java 17 web app with an embedded, disk-backed SQL database. */
public final class Main {
    private final Database database;
    private final int port;
    private final AuthService auth;
    private static final int MAX_BODY = 65536;

    private Main(Database database, int port) { this.database = database; this.port = port;this.auth=new AuthService(database,port); }

    public static void main(String[] args) {
        int port = 8787;
        Path data = defaultDataDirectory();
        boolean demo = true, openBrowser = false;
        try {
            for (int i=0; i<args.length; i++) {
                switch(args[i]) {
                    case "--port" -> port = Integer.parseInt(args[++i]);
                    case "--data" -> data = Path.of(args[++i]);
                    case "--empty" -> demo = false;
                    case "--open-browser" -> openBrowser = true;
                    case "--no-browser" -> openBrowser = false;
                    default -> throw new IllegalArgumentException("Unknown argument: " + args[i]);
                }
            }
            HttpServer server = HttpServer.create(new InetSocketAddress(InetAddress.getByName("127.0.0.1"),port),0);
            Database db;
            try { db = new Database(data,demo); }
            catch (Exception e) { server.stop(0); throw e; }
            Main app = new Main(db,port);
            server.createContext("/",app::handle);
            var executor = Executors.newFixedThreadPool(8);
            server.setExecutor(executor);
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                server.stop(0);
                executor.shutdownNow();
                try { db.close(); } catch (SQLException ignored) { }
            }));
            server.start();
            String url = "http://127.0.0.1:" + port;
            System.out.println("GuidanceDesk is running: " + url);
            System.out.println("SQL data: " + data.toAbsolutePath().normalize());
            System.out.println("Keep this window open. Press Ctrl+C to stop.");
            if (openBrowser && Desktop.isDesktopSupported()) {
                try { Desktop.getDesktop().browse(URI.create(url)); }
                catch (Exception e) { System.out.println("Open the address above in your browser."); }
            }
        } catch (BindException e) {
            System.err.println("Port " + port + " is in use. An existing GuidanceDesk instance may be running.");
            System.err.println("Open http://127.0.0.1:" + port + " or start with --port 8788.");
            System.exit(1);
        } catch (Exception e) {
            System.err.println("Could not start GuidanceDesk: " + e.getMessage());
            System.exit(1);
        }
    }

    private static Path defaultDataDirectory() {
        try {
            Path application = Path.of(Main.class.getProtectionDomain().getCodeSource().getLocation().toURI());
            if (Files.isRegularFile(application)) return application.getParent().resolve("data");
        } catch (Exception ignored) { }
        return Path.of("data");
    }

    private void handle(HttpExchange exchange) throws IOException {
        try {
            Headers headers = exchange.getResponseHeaders();
            headers.set("X-Content-Type-Options","nosniff");
            headers.set("X-Frame-Options","DENY");
            headers.set("Referrer-Policy","no-referrer");
            headers.set("Cache-Control","no-store");
            headers.set("Pragma","no-cache");
            headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
            headers.set("Cross-Origin-Resource-Policy","same-origin");
            headers.set("Cross-Origin-Opener-Policy","same-origin");
            headers.set("Vary","Origin, Sec-Fetch-Site");
            headers.set("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
            String host = exchange.getRequestHeaders().getFirst("Host");
            if (!Set.of("127.0.0.1:"+port,"localhost:"+port).contains(host == null ? "" : host.toLowerCase(Locale.ROOT))) {
                json(exchange,403,Map.of("error","Invalid local host.")); return;
            }
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();
            if(path.startsWith("/api/")) {
                String origin=exchange.getRequestHeaders().getFirst("Origin");
                String site=exchange.getRequestHeaders().getFirst("Sec-Fetch-Site");
                if((origin!=null&&!origin.equals("http://"+host))||"cross-site".equals(site)||"same-site".equals(site)) {
                    json(exchange,403,Map.of("error","Open this app directly in its own tab to continue."));return;
                }
            }
            if (path.equals("/api/health") && method.equals("GET")) {
                json(exchange,200,Map.of("app","GuidanceDesk","status","ok")); return;
            }
            if(path.equals("/api/auth/status")&&method.equals("GET")) {
                json(exchange,200,auth.describe(auth.bootstrap(exchange)));return;
            }
            if (path.startsWith("/api/")) {
                boolean publicAuth=path.equals("/api/auth/login")||path.equals("/api/auth/setup");
                AuthService.Session session=auth.requireSession(exchange,!publicAuth);
                auth.requireCsrf(exchange,session);
                if(path.equals("/api/state")&&method.equals("GET")) {
                    Map<String,Object> state=database.snapshot();state.put("csrf_token",session.csrf);state.put("account",session.account.publicInfo());
                    state.put("expires_in_seconds",auth.describe(session).get("expires_in_seconds"));json(exchange,200,state);return;
                }
                if (path.equals("/api/export/records.csv") && method.equals("GET")) {
                    database.auditEvent(session.account.username(),"EXPORT_CSV");
                    download(exchange,"guidance-records.csv","text/csv; charset=utf-8",recordsCsv()); return;
                }
                if (path.equals("/api/backup.sql") && method.equals("GET")) {
                    database.auditEvent(session.account.username(),"EXPORT_SQL");
                    download(exchange,"guidancedesk-backup.sql","application/sql; charset=utf-8",database.backup()); return;
                }
                if (!method.equals("POST")) { json(exchange,405,Map.of("error","This endpoint requires POST.")); return; }
                String type = exchange.getRequestHeaders().getFirst("Content-Type");
                if (type == null || !type.split(";",2)[0].trim().equalsIgnoreCase("application/x-www-form-urlencoded")) { json(exchange,415,Map.of("error","Use a form-encoded request.")); return; }
                Map<String,String> form = form(exchange);
                if(path.startsWith("/api/auth/")) {
                    AuthService.Session next;
                    switch(path) {
                        case "/api/auth/login" -> next=auth.login(exchange,session,form);
                        case "/api/auth/setup" -> next=auth.setup(exchange,session,form);
                        case "/api/auth/logout" -> next=auth.logout(exchange,session);
                        case "/api/auth/password" -> next=auth.changePassword(exchange,session,form);
                        default -> {json(exchange,404,Map.of("error","Endpoint not found."));return;}
                    }
                    json(exchange,200,auth.describe(next));return;
                }
                if(!Set.of("/api/students/save","/api/records/save","/api/records/archive","/api/notes/add","/api/appointments/save","/api/appointments/status","/api/settings/save").contains(path)) {json(exchange,404,Map.of("error","Endpoint not found."));return;}
                long id=database.apply(session.account,path,form);
                json(exchange,200,Map.of("ok",true,"id",id)); return;
            }
            if (!method.equals("GET")) { json(exchange,405,Map.of("error","Method not allowed.")); return; }
            String resource, type;
            switch(path) {
                case "/", "/index.html" -> { resource="index.html"; type="text/html; charset=utf-8"; }
                case "/app.js" -> { resource="app.js"; type="text/javascript; charset=utf-8"; }
                case "/style.css" -> { resource="style.css"; type="text/css; charset=utf-8"; }
                case "/favicon.svg" -> { resource="favicon.svg"; type="image/svg+xml"; }
                default -> { json(exchange,404,Map.of("error","Page not found.")); return; }
            }
            try (InputStream input = Main.class.getResourceAsStream("/public/" + resource)) {
                if (input == null) { json(exchange,404,Map.of("error","Missing app resource.")); return; }
                send(exchange,200,type,input.readAllBytes());
            }
        } catch (SecurityProblem e) {
            json(exchange,e.status(),Map.of("error",e.getMessage()));
        } catch (IllegalArgumentException e) {
            json(exchange,400,Map.of("error",e.getMessage()==null ? "Invalid request." : e.getMessage()));
        } catch (SQLException e) {
            System.err.println("SQL request failed: " + e.getSQLState());
            json(exchange,500,Map.of("error","The database could not save this change. Refresh and try again."));
        } catch (Exception e) {
            System.err.println("Request failed: " + e.getClass().getSimpleName());
            json(exchange,500,Map.of("error","The request could not be completed. Refresh and try again."));
        } finally { exchange.close(); }
    }

    private static Map<String,String> form(HttpExchange exchange) throws IOException {
        byte[] bytes = exchange.getRequestBody().readNBytes(MAX_BODY+1);
        if (bytes.length>MAX_BODY) throw new SecurityProblem(413,"This request is too large.");
        Map<String,String> form = new HashMap<>();
        String body = new String(bytes,StandardCharsets.UTF_8);
        if (!body.isEmpty()) for (String part : body.split("&")) {
            String[] pair = part.split("=",2);
            String key=URLDecoder.decode(pair[0],StandardCharsets.UTF_8);
            if(key.length()>64||form.size()>=30||form.containsKey(key)) throw new IllegalArgumentException("Invalid or repeated form field.");
            form.put(key,pair.length>1?URLDecoder.decode(pair[1],StandardCharsets.UTF_8):"");
        }
        return form;
    }

    @SuppressWarnings("unchecked")
    private String recordsCsv() throws SQLException {
        Map<String,Object> state = database.snapshot();
        Map<Object,Map<String,Object>> students = new HashMap<>();
        for (var student : (List<Map<String,Object>>)state.get("students")) students.put(student.get("id"),student);
        StringBuilder csv = new StringBuilder("\uFEFFRecord ID,Student ID,Student,Grade,Title,Category,Priority,Status,Opened,Follow-up,Counselor,Summary,Archived\r\n");
        for (var record : (List<Map<String,Object>>)state.get("records")) {
            var student = students.get(record.get("student_id"));
            Object[] cells = {record.get("id"),student.get("school_id"),student.get("first_name")+" "+student.get("last_name"),student.get("grade"),record.get("title"),record.get("category"),record.get("priority"),record.get("status"),record.get("opened_on"),record.get("follow_up"),record.get("counselor"),record.get("summary"),record.get("archived")};
            for(int i=0;i<cells.length;i++) { if(i>0) csv.append(','); csv.append(csvCell(cells[i])); }
            csv.append("\r\n");
        }
        return csv.toString();
    }

    static String csvCell(Object raw) {
        String value = raw==null ? "" : raw.toString();
        String normalized = value.stripLeading();
        if ((!normalized.isEmpty() && "=+@-".indexOf(normalized.charAt(0))>=0) || value.startsWith("\t") || value.startsWith("\r") || value.startsWith("\n")) value="'"+value;
        return "\""+value.replace("\"","\"\"")+"\"";
    }
    private static void download(HttpExchange exchange,String name,String type,String value) throws IOException {
        exchange.getResponseHeaders().set("Content-Disposition","attachment; filename=\""+name+"\"");
        send(exchange,200,type,value.getBytes(StandardCharsets.UTF_8));
    }
    private static void json(HttpExchange exchange,int status,Object data) throws IOException {
        send(exchange,status,"application/json; charset=utf-8",toJson(data).getBytes(StandardCharsets.UTF_8));
    }
    private static void send(HttpExchange exchange,int status,String type,byte[] bytes) throws IOException {
        exchange.getResponseHeaders().set("Content-Type",type);
        exchange.sendResponseHeaders(status,bytes.length);
        exchange.getResponseBody().write(bytes);
    }

    static String toJson(Object value) {
        if (value==null) return "null";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Map<?,?> map) {
            StringJoiner out = new StringJoiner(",","{","}");
            for (var item : map.entrySet()) out.add(toJson(item.getKey().toString())+":"+toJson(item.getValue()));
            return out.toString();
        }
        if (value instanceof Iterable<?> items) {
            StringJoiner out = new StringJoiner(",","[","]");
            for (Object item : items) out.add(toJson(item));
            return out.toString();
        }
        StringBuilder out = new StringBuilder("\"");
        for(char c : value.toString().toCharArray()) {
            switch(c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> { if(c<32) out.append(String.format("\\u%04x",(int)c)); else out.append(c); }
            }
        }
        return out.append('"').toString();
    }
}
