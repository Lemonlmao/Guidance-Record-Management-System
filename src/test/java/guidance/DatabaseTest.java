package guidance;

import java.io.StringReader;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import org.h2.tools.RunScript;

/** Real H2 checks, including deliberate corruption of isolated test databases. */
public final class DatabaseTest {
    private static int checks;
    private static final Database.Account OWNER=new Database.Account("tester","Test Counselor");
    private static void check(boolean condition,String message) { if(!condition) throw new AssertionError(message);checks++; }
    private static Map<String,String> form(String... values) {
        Map<String,String> map=new HashMap<>();for(int i=0;i<values.length;i+=2) map.put(values[i],values[i+1]);return map;
    }
    @SuppressWarnings("unchecked") private static List<Map<String,Object>> rows(Database db,String key) throws Exception { return (List<Map<String,Object>>)db.snapshot().get(key); }
    private static long call(Database db,String action,Map<String,String> original) throws Exception {
        Map<String,String> form=new HashMap<>(original);
        String collection=action.startsWith("students/")?"students":action.startsWith("records/")||action.equals("notes/add")?"records":action.startsWith("appointments/")?"appointments":"";
        String id=form.getOrDefault(action.equals("notes/add")?"record_id":"id","");
        if(!id.isBlank()&&!collection.isEmpty()&&!form.containsKey("version")) {
            for(var row:rows(db,collection)) if(row.get("id").toString().equals(id)) form.put("version",row.get("version").toString());
        }
        if(action.equals("settings/save")&&!form.containsKey("version")) form.put("version",((Map<?,?>)db.snapshot().get("settings")).get("workspace_version").toString());
        return db.apply(OWNER,"/api/"+action,form);
    }
    @FunctionalInterface private interface Operation { void run() throws Exception; }
    private static void rejects(Operation operation,String text) throws Exception {
        try { operation.run();throw new AssertionError("Accepted invalid input: "+text); }
        catch(IllegalArgumentException error) { check(error.getMessage().toLowerCase().contains(text.toLowerCase()),"Validation: "+text); }
    }
    private static void blocked(Operation operation,int status) throws Exception {
        try {operation.run();throw new AssertionError("Expected security failure "+status);}
        catch(SecurityProblem error) {check(error.status()==status,"Security failure "+status);}
    }
    private static Map<String,String> account(String password) {return form("username","tester","display_name","Test Counselor","password",password,"password_confirmation",password);}
    private static Connection raw(Path directory) throws Exception {
        return DriverManager.getConnection("jdbc:h2:file:"+directory.resolve("guidance").toAbsolutePath().toString().replace('\\','/'),"guidance",Files.readString(directory.resolve("connection.key")).trim());
    }
    public static void main(String[] args) throws Exception {
        Path root=Files.createTempDirectory(Path.of(args[0]),"guidance-security-");
        Path original=root.resolve("original");String password=Passwords.token(),backup;
        long studentId,recordId;
        try(Database db=new Database(original,false)) {
            check(!db.hasAccount(),"No default owner is shipped");
            check(rows(db,"students").isEmpty(),"An empty workspace has no sample students");
            rejects(()->db.apply(null,"/api/auth/setup",account("short")),"15");
            db.apply(null,"/api/auth/setup",account(password));
            check(db.authenticate("tester",password)!=null,"Account authenticates");
            check(db.authenticate("tester",Passwords.token())==null,"Wrong passphrase is rejected");
            check(db.authenticate("unknown",password)==null,"Unknown username is rejected");
            blocked(()->db.apply(null,"/api/auth/setup",account(password)),409);
            blocked(()->db.apply(null,"/api/students/save",Map.of()),401);
            String state=Main.toJson(db.snapshot());
            check(!state.contains(password)&&!state.contains("password_hash")&&!state.contains("password_salt"),"Public state excludes password material");
            var student=form("school_id","TEST-001","first_name","Zoë","last_name","O'Neil","grade","Grade 10","section_name","Oak","email","zoe@example.test");
            studentId=call(db,"students/save",student);
            check(rows(db,"students").get(0).get("last_name").equals("O'Neil"),"Quoted Unicode names round-trip");
            var duplicate=new HashMap<>(student);duplicate.put("school_id","test-001");rejects(()->call(db,"students/save",duplicate),"already in use");
            var invalid=new HashMap<>(student);invalid.put("school_id","TEST-002");invalid.put("email","invalid");rejects(()->call(db,"students/save",invalid),"email");
            invalid.put("email","");invalid.put("first_name"," ");rejects(()->call(db,"students/save",invalid),"first name");
            var edited=new HashMap<>(student);edited.put("id",Long.toString(studentId));edited.put("version","0");edited.put("section_name","Updated");call(db,"students/save",edited);
            blocked(()->call(db,"students/save",edited),409);
            var record=form("student_id",Long.toString(studentId),"title","Study plan'); DROP TABLE students; --","category","Academic","priority","High","status","Open","opened_on","2026-11-15","follow_up","2026-11-20","counselor","Test Counselor","summary","Unicode ✓\nSecond line <script>alert(1)</script>");
            recordId=call(db,"records/save",record);
            check(rows(db,"records").size()==1&&rows(db,"students").size()==1,"SQL injection payload is stored as text");
            var wrong=new HashMap<>(record);wrong.put("follow_up","2026-11-01");rejects(()->call(db,"records/save",wrong),"follow-up");
            wrong.put("follow_up","2026-02-30");rejects(()->call(db,"records/save",wrong),"date");
            var missing=new HashMap<>(record);missing.put("student_id","999999");rejects(()->call(db,"records/save",missing),"no longer exists");
            var category=new HashMap<>(record);category.put("category","Unknown");rejects(()->call(db,"records/save",category),"category");
            record.put("id",Long.toString(recordId));record.put("version","0");record.put("status","Resolved");call(db,"records/save",record);
            check(rows(db,"records").get(0).get("status").equals("Resolved"),"Record updates persist");
            blocked(()->call(db,"records/save",record),409);
            call(db,"notes/add",form("record_id",Long.toString(recordId),"author","Spoofed Author","body","Follow-up ✓\nText <b>stays text</b>"));
            check(rows(db,"notes").get(0).get("author").equals(OWNER.displayName()),"The server supplies the note author");
            check(rows(db,"notes").get(0).get("body").equals("Follow-up ✓\nText <b>stays text</b>"),"Multiline notes round-trip");
            rejects(()->call(db,"notes/add",form("record_id",Long.toString(recordId),"body"," ")),"body");
            blocked(()->call(db,"notes/add",form("record_id",Long.toString(recordId),"version","0","body","Stale note")),409);
            check(rows(db,"notes").size()==1,"Rejected notes do not partially insert");
            call(db,"records/archive",form("id",Long.toString(recordId),"archived","true"));
            check(Boolean.TRUE.equals(rows(db,"records").get(0).get("archived")),"Archive preserves the record");
            call(db,"records/archive",form("id",Long.toString(recordId),"archived","false"));
            check(Boolean.FALSE.equals(rows(db,"records").get(0).get("archived")),"Archived records restore");
            var appointment=form("student_id",Long.toString(studentId),"title","Check-in","day","2026-11-20","starts_at","09:00","duration","45","counselor","Test Counselor","location_name","Office","status","Scheduled","notes","");
            long appointmentId=call(db,"appointments/save",appointment);
            var overlap=new HashMap<>(appointment);overlap.put("starts_at","09:30");rejects(()->call(db,"appointments/save",overlap),"overlaps");
            overlap.put("counselor","Other Counselor");rejects(()->call(db,"appointments/save",overlap),"overlaps");
            var other=new HashMap<>(student);other.put("school_id","TEST-002");other.put("first_name","Alex");long otherId=call(db,"students/save",other);
            overlap.put("student_id",Long.toString(otherId));overlap.put("counselor","test counselor");rejects(()->call(db,"appointments/save",overlap),"overlaps");
            var adjacent=new HashMap<>(appointment);adjacent.put("starts_at","09:45");call(db,"appointments/save",adjacent);
            check(rows(db,"appointments").size()==2,"Adjacent bookings are allowed");
            call(db,"appointments/status",form("id",Long.toString(appointmentId),"status","Cancelled"));call(db,"appointments/save",appointment);
            check(rows(db,"appointments").size()==3,"Cancellation releases the slot");
            blocked(()->call(db,"appointments/status",form("id",Long.toString(appointmentId),"version","0","status","Completed")),409);
            var midnight=new HashMap<>(appointment);midnight.put("starts_at","23:45");rejects(()->call(db,"appointments/save",midnight),"same day");
            var settings=form("school_name","Test School","workspace_name","Test Office","counselor_name","A. Counselor","school_year","2026 - 2027","version","0");call(db,"settings/save",settings);
            blocked(()->call(db,"settings/save",settings),409);
            check(((Map<?,?>)db.snapshot().get("settings")).get("school_name").equals("Test School"),"Settings save transactionally");
            check(rows(db,"audit").stream().anyMatch(row->row.get("action_name").equals("notes/add")&&row.get("actor").equals("tester")),"Signed changes appear in audit history");
            db.verifyIntegrity();check(true,"Valid audit history verifies");
            AtomicLong clock=new AtomicLong(1_000);AuthService auth=new AuthService(db,9999,clock::get);
            var session=auth.createSession(OWNER);clock.addAndGet(AuthService.IDLE_MILLIS);check(auth.find(session.id,false)==null,"Idle sessions expire");
            session=auth.createSession(OWNER);clock.addAndGet(AuthService.IDLE_MILLIS-1);check(auth.find(session.id,true)!=null,"Authenticated activity renews idle time");
            for(int i=0;i<34;i++){clock.addAndGet(AuthService.IDLE_MILLIS-1);auth.find(session.id,true);}
            check(auth.find(session.id,false)==null,"Absolute lifetime cannot be extended indefinitely");
            for(int i=0;i<5;i++) auth.reserveAttempt();blocked(auth::reserveAttempt,429);clock.addAndGet(AuthService.IDLE_MILLIS);auth.reserveAttempt();check(true,"Login throttling expires after its window");
            backup=db.backup();check(backup.contains("CREATE")&&backup.contains("INSERT"),"Backup contains structure and data");
        }
        try(Database db=new Database(original,true)) {
            check(rows(db,"students").size()==2&&rows(db,"records").size()==1&&rows(db,"notes").size()==1,"Records and notes survive restart without reseeding");
            check(db.authenticate("tester",password)!=null,"Owner account survives restart");
        }
        Path restored=root.resolve("restored");Files.createDirectories(restored);String dbPassword=Passwords.token();Files.writeString(restored.resolve("connection.key"),dbPassword);Files.copy(original.resolve("integrity.key"),restored.resolve("integrity.key"));
        try(var connection=raw(restored)) {RunScript.execute(connection,new StringReader(backup));}
        try(Database db=new Database(restored,false)) {check(rows(db,"students").size()==2&&rows(db,"appointments").size()==3,"SQL backup restores with its matching integrity key");check(db.authenticate("tester",password)!=null,"Restored account works");}
        Path tampered=root.resolve("tampered-data");
        try(Database db=new Database(tampered,true)) {
            try(var connection=raw(tampered);var statement=connection.createStatement()){statement.executeUpdate("UPDATE students SET first_name='Manipulated' WHERE id=1");}
            blocked(db::snapshot,503);blocked(()->db.apply(OWNER,"/api/students/save",Map.of()),503);
        }
        blocked(()->{try(Database ignored=new Database(tampered,false)){}},503);
        Path audit=root.resolve("tampered-audit");
        try(Database db=new Database(audit,false)) {
            try(var connection=raw(audit);var statement=connection.createStatement()){statement.executeUpdate("UPDATE audit_events SET actor='changed' WHERE id=1");}
            blocked(db::verifyIntegrity,503);
        }
        Path removed=root.resolve("deleted-audit");
        try(Database db=new Database(removed,false)) {
            try(var connection=raw(removed);var statement=connection.createStatement()){statement.executeUpdate("DELETE FROM audit_events");}
            blocked(db::verifyIntegrity,503);
        }
        Path keyless=root.resolve("missing-key");try(Database ignored=new Database(keyless,false)){}Files.move(keyless.resolve("integrity.key"),root.resolve("saved-test-key"));
        blocked(()->{try(Database ignored=new Database(keyless,false)){}},503);
        Path demo=root.resolve("demo");try(Database db=new Database(demo,true)){check(rows(db,"students").size()==12&&rows(db,"records").size()==16,"Sample workspace initializes");}try(Database db=new Database(demo,true)){check(rows(db,"records").size()==16,"Sample workspace initializes only once");}
        String saltA=Passwords.salt(),saltB=Passwords.salt();check(!saltA.equals(saltB),"Password salts are unique");check(Passwords.matches(password,saltA,Passwords.hash(password,saltA,Passwords.ITERATIONS),Passwords.ITERATIONS),"PBKDF2 hashes verify");
        check(!Passwords.equalTokens(null,"token"),"Missing CSRF tokens fail closed");
        check(Main.toJson("Quote \" newline\n").equals("\"Quote \\\" newline\\n\""),"JSON escapes control characters");check(Main.csvCell("=SUM(A1)\nvalue").startsWith("\"'="),"CSV blocks multiline spreadsheet formulas");check(Main.csvCell("a,\"b\"").equals("\"a,\"\"b\"\"\""),"CSV quotes commas and quotes");
        System.out.println("PASS: "+checks+" Java/H2/security checks, including tampering, stale edits, sessions, restart, and backup restore.");
    }
}
