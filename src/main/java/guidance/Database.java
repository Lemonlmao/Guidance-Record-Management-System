package guidance;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.h2.tools.RunScript;

/** JDBC persistence. All user values are bound parameters. */
public final class Database implements AutoCloseable {
    private final Connection connection;
    private byte[] integrityKey;
    public record Account(String username,String displayName) {
        public Map<String,String> publicInfo() { return Map.of("username",username,"display_name",displayName); }
    }
    private static final Set<String> CATEGORIES = Set.of("Academic", "Career", "Personal", "Behavioral", "Family", "Attendance");
    private static final Set<String> STATUSES = Set.of("Open", "In progress", "Resolved");
    private static final Set<String> PRIORITIES = Set.of("Low", "Normal", "High");
    public static final ZoneId ZONE = ZoneId.of("Asia/Manila");

    public Database(Path dataDir, boolean demo) throws Exception {
        Files.createDirectories(dataDir);
        Path key = dataDir.resolve("connection.key");
        if (!Files.exists(key)) Files.writeString(key, UUID.randomUUID().toString(), StandardOpenOption.CREATE_NEW);
        String url = "jdbc:h2:file:" + dataDir.resolve("guidance").toAbsolutePath().toString().replace('\\', '/') + ";DB_CLOSE_ON_EXIT=FALSE";
        connection = DriverManager.getConnection(url, "guidance", Files.readString(key).trim());
        try (InputStream source = Database.class.getResourceAsStream("/sql/schema.sql")) {
            if (source == null) throw new IOException("Missing SQL schema resource");
            RunScript.execute(connection, new InputStreamReader(source, StandardCharsets.UTF_8));
        }
        if (query("SELECT * FROM settings WHERE setting_key = ?", "initialized").isEmpty()) {
            connection.setAutoCommit(false);
            try {
                setting("school_name", "Westbridge Academy");
                setting("counselor_name", "Jordan Miller");
                setting("school_year", schoolYear());
                setting("workspace_name", "Guidance Office");
                setting("sample_data", demo ? "true" : "false");
                setting("workspace_version", "0");
                if (demo) seed();
                setting("initialized", "true");
                connection.commit();
            } catch (Exception e) { connection.rollback(); throw e; }
            finally { connection.setAutoCommit(true); }
        }
        try { initializeIntegrity(dataDir); }
        catch(Exception error) { connection.close();throw error; }
    }

    private static String schoolYear() {
        LocalDate now = LocalDate.now(ZONE);
        int year = now.getMonthValue() >= 6 ? now.getYear() : now.getYear() - 1;
        return year + " - " + (year + 1);
    }

    public synchronized Map<String,Object> snapshot() throws SQLException {
        verifyIntegrity();
        Map<String,Object> state = new LinkedHashMap<>();
        state.put("students", query("SELECT * FROM students ORDER BY last_name, first_name"));
        state.put("records", query("SELECT * FROM guidance_records ORDER BY updated_at DESC, id DESC"));
        state.put("notes", query("SELECT * FROM case_notes ORDER BY created_at DESC, id DESC"));
        state.put("appointments", query("SELECT id,student_id,title,appointment_date AS \"day\",starts_at,duration,counselor,location_name,status,notes,created_at,version FROM appointments ORDER BY appointment_date, starts_at"));
        Map<String,Object> settings = new LinkedHashMap<>();
        for (Map<String,Object> row : query("SELECT * FROM settings")) settings.put((String)row.get("setting_key"), row.get("setting_value"));
        state.put("settings", settings);
        state.put("today", LocalDate.now(ZONE).toString());
        state.put("audit",query("SELECT id,occurred_at,actor,action_name,entity_id FROM audit_events ORDER BY id DESC LIMIT 50"));
        state.put("security",Map.of("integrity","verified","audit_count",query("SELECT COUNT(*) AS total FROM audit_events").get(0).get("total")));
        return state;
    }

    private long saveStudent(Map<String,String> form) throws SQLException {
        long id = id(form, "id", false);
        String schoolId = required(form, "school_id", 40).toUpperCase(Locale.ROOT);
        String first = required(form, "first_name", 80);
        String last = required(form, "last_name", 80);
        String grade = required(form, "grade", 40);
        String section = optional(form, "section_name", 60);
        String email = optional(form, "email", 150);
        if (!email.isEmpty() && !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw invalid("Enter a valid email address.");
        if (!query("SELECT id FROM students WHERE UPPER(school_id) = ? AND id <> ?", schoolId, id).isEmpty()) throw invalid("That student ID is already in use.");
        if (id > 0) {
            long version=checkVersion("students",id,form);
            changed(update("UPDATE students SET school_id=?, first_name=?, last_name=?, grade=?, section_name=?, email=?,version=version+1 WHERE id=? AND version=?", schoolId, first, last, grade, section, email, id,version));
            return id;
        }
        return insert("INSERT INTO students(school_id,first_name,last_name,grade,section_name,email) VALUES(?,?,?,?,?,?)", schoolId, first, last, grade, section, email);
    }

    private long saveRecord(Map<String,String> form) throws SQLException {
        long id = id(form, "id", false);
        long studentId = id(form, "student_id", true);
        exists("students", studentId);
        String title = required(form, "title", 180);
        String category = choice(form, "category", CATEGORIES);
        String priority = choice(form, "priority", PRIORITIES);
        String status = choice(form, "status", STATUSES);
        String date = date(form, "opened_on", true);
        String follow = date(form, "follow_up", false);
        if (follow != null && follow.compareTo(date) < 0) throw invalid("Follow-up must be on or after the record date.");
        String counselor = required(form, "counselor", 120);
        String summary = optional(form, "summary", 6000);
        if (id > 0) {
            long version=checkVersion("guidance_records",id,form);
            changed(update("UPDATE guidance_records SET student_id=?,title=?,category=?,priority=?,status=?,opened_on=?,follow_up=?,counselor=?,summary=?,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND version=?", studentId,title,category,priority,status,date,follow,counselor,summary,id,version));
            return id;
        }
        return insert("INSERT INTO guidance_records(student_id,title,category,priority,status,opened_on,follow_up,counselor,summary) VALUES(?,?,?,?,?,?,?,?,?)",studentId,title,category,priority,status,date,follow,counselor,summary);
    }

    private void archiveRecord(Map<String,String> form) throws SQLException {
        long id = id(form, "id", true);
        long version=checkVersion("guidance_records",id,form);
        String value = choice(form, "archived", Set.of("true", "false"));
        changed(update("UPDATE guidance_records SET archived=?,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND version=?", Boolean.parseBoolean(value), id,version));
    }

    private long addNote(Map<String,String> form) throws SQLException {
        long recordId = id(form, "record_id", true);
        long version=checkVersion("guidance_records",recordId,form);
        String body = required(form, "body", 6000);
        String author = required(form, "author", 120);
        long id = insert("INSERT INTO case_notes(record_id,author,body) VALUES(?,?,?)", recordId, author, body);
        changed(update("UPDATE guidance_records SET updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND version=?", recordId,version));
        return id;
    }

    private long saveAppointment(Map<String,String> form) throws SQLException {
        long id = id(form,"id",false);
        long studentId = id(form,"student_id",true);
        exists("students", studentId);
        String title = required(form,"title",180);
        String day = date(form,"day",true);
        String time = required(form,"starts_at",5);
        if (!time.matches("\\d{2}:\\d{2}")) throw invalid("Enter a valid appointment time.");
        LocalTime start;
        try { start = LocalTime.parse(time); } catch (Exception e) { throw invalid("Enter a valid appointment time."); }
        int duration;
        try { duration = Integer.parseInt(required(form,"duration",3)); } catch (NumberFormatException e) { throw invalid("Enter a duration between 15 and 180 minutes."); }
        if (duration < 15 || duration > 180 || start.toSecondOfDay()/60 + duration > 1440) throw invalid("Use a duration of 15-180 minutes that ends on the same day.");
        String counselor = required(form,"counselor",120);
        String location = required(form,"location_name",120);
        String notes = optional(form,"notes",3000);
        String status = choice(form,"status",Set.of("Scheduled","Completed","Cancelled"));
        if (status.equals("Scheduled")) {
            for (Map<String,Object> appointment : query("SELECT * FROM appointments WHERE appointment_date=? AND status='Scheduled' AND id<>?",day,id)) {
                if (!counselor.equalsIgnoreCase((String)appointment.get("counselor")) && ((Number)appointment.get("student_id")).longValue() != studentId) continue;
                int a = start.toSecondOfDay()/60, b = LocalTime.parse((String)appointment.get("starts_at")).toSecondOfDay()/60;
                int otherDuration = ((Number)appointment.get("duration")).intValue();
                if (a < b + otherDuration && b < a + duration) throw invalid("This time overlaps another appointment for the student or counselor.");
            }
        }
        if (id > 0) {
            long version=checkVersion("appointments",id,form);
            changed(update("UPDATE appointments SET student_id=?,title=?,appointment_date=?,starts_at=?,duration=?,counselor=?,location_name=?,notes=?,status=?,version=version+1 WHERE id=? AND version=?",studentId,title,day,time,duration,counselor,location,notes,status,id,version));
            return id;
        }
        return insert("INSERT INTO appointments(student_id,title,appointment_date,starts_at,duration,counselor,location_name,notes,status) VALUES(?,?,?,?,?,?,?,?,?)",studentId,title,day,time,duration,counselor,location,notes,status);
    }

    private void appointmentStatus(Map<String,String> form) throws SQLException {
        long id = id(form,"id",true);
        String status = choice(form,"status",Set.of("Completed","Cancelled"));
        long version=checkVersion("appointments",id,form);
        changed(update("UPDATE appointments SET status=?,version=version+1 WHERE id=? AND version=?",status,id,version));
    }

    private void saveSettings(Map<String,String> form) throws SQLException {
        Map<String,String> validated = new LinkedHashMap<>();
        for (String key : List.of("school_name","counselor_name","school_year","workspace_name")) validated.put(key,required(form,key,key.equals("school_year") ? 30 : 120));
        long version=version(form);
        long current=Long.parseLong((String)query("SELECT setting_value FROM settings WHERE setting_key='workspace_version'").get(0).get("setting_value"));
        if(version!=current) throw conflict();
        for (var item : validated.entrySet()) setting(item.getKey(),item.getValue());
        setting("workspace_version",Long.toString(current+1));
    }

    public synchronized String backup() throws SQLException {
        verifyIntegrity();
        StringBuilder output = new StringBuilder("-- GuidanceDesk SQL backup. Contains private records and password hashes.\n-- Restore into a NEW, EMPTY H2 database. Copy the matching integrity.key separately.\n");
        for (Map<String,Object> row : query("SCRIPT")) for (Object value : row.values()) output.append(value).append('\n');
        return output.toString();
    }

    /** All HTTP mutations use this transaction boundary: check, write, sign, commit. */
    public synchronized long apply(Account account,String action,Map<String,String> input) throws SQLException {
        if(account==null&&!action.equals("/api/auth/setup")) throw new SecurityProblem(401,"Sign in to continue.");
        Map<String,String> form=new HashMap<>(input);
        if(action.equals("/api/notes/add")) form.put("author",account.displayName());
        verifyIntegrity();
        connection.setAutoCommit(false);
        try {
            long result=0;
            switch(action) {
                case "/api/auth/setup" -> createAccount(form);
                case "/api/auth/password" -> changePassword(account,form);
                case "/api/students/save" -> result=saveStudent(form);
                case "/api/records/save" -> result=saveRecord(form);
                case "/api/records/archive" -> archiveRecord(form);
                case "/api/notes/add" -> result=addNote(form);
                case "/api/appointments/save" -> result=saveAppointment(form);
                case "/api/appointments/status" -> appointmentStatus(form);
                case "/api/settings/save" -> saveSettings(form);
                default -> throw new IllegalArgumentException("Unknown operation.");
            }
            String actor=account==null?required(form,"username",40).toLowerCase(Locale.ROOT):account.username();
            String entity=action.contains("/auth/")||action.equals("/api/settings/save")?"":result>0?Long.toString(result):Long.toString(id(form,"id",true));
            appendAudit(actor,action.replace("/api/",""),entity);
            connection.commit();
            return result;
        } catch(SQLException|RuntimeException error) { connection.rollback();throw error; }
        finally { connection.setAutoCommit(true); }
    }

    public synchronized boolean hasAccount() throws SQLException { verifyIntegrity();return owner()!=null; }

    public synchronized Account authenticate(String username,String password) throws SQLException {
        verifyIntegrity();
        var rows=query("SELECT * FROM owner_account WHERE id=1");
        if(rows.isEmpty()||!rows.get(0).get("username").equals(username.toLowerCase(Locale.ROOT))) {
            Passwords.hash(password.length()>512?"invalid":password,Base64.getEncoder().encodeToString(new byte[16]),Passwords.ITERATIONS);
            return null;
        }
        var row=rows.get(0);
        boolean valid=Passwords.matches(password,(String)row.get("password_salt"),(String)row.get("password_hash"),((Number)row.get("iterations")).intValue());
        return valid?new Account((String)row.get("username"),(String)row.get("display_name")):null;
    }

    private Account owner() throws SQLException {
        var rows=query("SELECT username,display_name FROM owner_account WHERE id=1");
        return rows.isEmpty()?null:new Account((String)rows.get(0).get("username"),(String)rows.get(0).get("display_name"));
    }
    private void createAccount(Map<String,String> form) throws SQLException {
        if(owner()!=null) throw new SecurityProblem(409,"This workspace already has an owner. Sign in instead.");
        String username=required(form,"username",40).toLowerCase(Locale.ROOT);
        if(!username.matches("[a-z0-9._-]{3,40}")) throw invalid("Use 3–40 letters, numbers, dots, underscores, or hyphens for the username.");
        String display=required(form,"display_name",80),password=newPassword(form);
        String salt=Passwords.salt(),hash=Passwords.hash(password,salt,Passwords.ITERATIONS);
        update("INSERT INTO owner_account(id,username,display_name,password_salt,password_hash,iterations) VALUES(1,?,?,?,?,?)",username,display,salt,hash,Passwords.ITERATIONS);
        setting("counselor_name",display);
    }
    private void changePassword(Account account,Map<String,String> form) throws SQLException {
        String current=form.getOrDefault("current_password","");
        if(authenticate(account.username(),current)==null) throw new SecurityProblem(403,"The current passphrase is incorrect.");
        String password=newPassword(form);
        if(password.equals(current)) throw invalid("Choose a different passphrase.");
        String salt=Passwords.salt();
        update("UPDATE owner_account SET password_salt=?,password_hash=?,iterations=? WHERE id=1",salt,Passwords.hash(password,salt,Passwords.ITERATIONS),Passwords.ITERATIONS);
    }
    private static String newPassword(Map<String,String> form) {
        String password=form.getOrDefault("password","");
        Passwords.validate(password);
        if(!password.equals(form.get("password_confirmation"))) throw invalid("The passphrases do not match.");
        return password;
    }

    public synchronized void auditEvent(String actor,String action) throws SQLException {
        if(!Set.of("LOGIN_SUCCEEDED","LOGIN_FAILED","LOGOUT","EXPORT_CSV","EXPORT_SQL").contains(action)) throw invalid("Unknown audit action.");
        verifyIntegrity();connection.setAutoCommit(false);
        try { appendAudit(actor,action,"");connection.commit(); }
        catch(SQLException|RuntimeException error) { connection.rollback();throw error; }
        finally { connection.setAutoCommit(true); }
    }

    private void initializeIntegrity(Path dataDir) throws Exception {
        Path key=dataDir.resolve("integrity.key");
        boolean hasEvents=!query("SELECT id FROM audit_events LIMIT 1").isEmpty();
        boolean initialized=!query("SELECT * FROM settings WHERE setting_key='integrity_initialized'").isEmpty();
        if(hasEvents||initialized) {
            if(!Files.isRegularFile(key)) throw integrityFailure();
            integrityKey=Base64.getDecoder().decode(Files.readString(key).trim());
            if(integrityKey.length!=32) throw integrityFailure();
            verifyIntegrity();return;
        }
        if(Files.exists(key)) throw integrityFailure();
        integrityKey=Passwords.randomBytes(32);
        Files.writeString(key,Base64.getEncoder().encodeToString(integrityKey),StandardOpenOption.CREATE_NEW);
        connection.setAutoCommit(false);
        try {
            if(query("SELECT setting_key FROM settings WHERE setting_key='workspace_version'").isEmpty()) setting("workspace_version","0");
            setting("integrity_initialized","true");
            appendAudit("system","BASELINE","");connection.commit();
        } catch(Exception error) { connection.rollback();throw error; }
        finally { connection.setAutoCommit(true); }
    }

    public synchronized void verifyIntegrity() throws SQLException {
        var events=query("SELECT * FROM audit_events ORDER BY id");
        if(events.isEmpty()) throw integrityFailure();
        String previous="0".repeat(64);long expectedId=1;
        for(var event:events) {
            if(((Number)event.get("id")).longValue()!=expectedId++||!previous.equals(event.get("previous_mac"))) throw integrityFailure();
            String mac=eventMac(event);
            if(!Passwords.equalTokens(mac,(String)event.get("event_mac"))) throw integrityFailure();
            previous=mac;
        }
        if(!Passwords.equalTokens(dataFingerprint(),(String)events.get(events.size()-1).get("data_fingerprint"))) throw integrityFailure();
    }
    private void appendAudit(String actor,String action,String entity) throws SQLException {
        var last=query("SELECT id,event_mac FROM audit_events ORDER BY id DESC LIMIT 1");
        long id=last.isEmpty()?1:((Number)last.get(0).get("id")).longValue()+1;
        String previous=last.isEmpty()?"0".repeat(64):(String)last.get(0).get("event_mac");
        Map<String,Object> event=new LinkedHashMap<>();
        event.put("id",id);event.put("occurred_at",Instant.now().toString());event.put("actor",actor);event.put("action_name",action);event.put("entity_id",entity);event.put("data_fingerprint",dataFingerprint());event.put("previous_mac",previous);
        update("INSERT INTO audit_events(id,occurred_at,actor,action_name,entity_id,data_fingerprint,previous_mac,event_mac) VALUES(?,?,?,?,?,?,?,?)",id,event.get("occurred_at"),actor,action,entity,event.get("data_fingerprint"),previous,eventMac(event));
    }
    private String eventMac(Map<String,Object> event) {
        String data=Main.toJson(List.of("id","occurred_at","actor","action_name","entity_id","data_fingerprint","previous_mac").stream().map(key->event.get(key).toString()).toList());
        try {
            Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(integrityKey,"HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch(GeneralSecurityException error) { throw new IllegalStateException("Integrity verification is unavailable.",error); }
    }
    private String dataFingerprint() throws SQLException {
        Map<String,Object> data=new LinkedHashMap<>();
        for(String table:List.of("students","guidance_records","case_notes","appointments","owner_account")) data.put(table,query("SELECT * FROM "+table+" ORDER BY id"));
        data.put("settings",query("SELECT * FROM settings ORDER BY setting_key"));
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Main.toJson(data).getBytes(StandardCharsets.UTF_8))); }
        catch(GeneralSecurityException error) { throw new IllegalStateException(error); }
    }
    private static SecurityProblem integrityFailure() { return new SecurityProblem(503,"Workspace integrity verification failed. Access is locked. Restore a complete trusted backup; do not edit the database or keys."); }
    private static SecurityProblem conflict() { return new SecurityProblem(409,"This item changed since you opened it. Refresh the workspace and review the latest changes before saving again."); }
    private static long version(Map<String,String> form) {
        try { long value=Long.parseLong(form.getOrDefault("version",""));if(value>=0) return value; }
        catch(NumberFormatException ignored) { }
        throw new SecurityProblem(409,"The item version is missing or invalid. Refresh the workspace before saving.");
    }
    private long checkVersion(String table,long id,Map<String,String> form) throws SQLException {
        exists(table,id);long expected=version(form);
        long actual=((Number)query("SELECT version FROM "+table+" WHERE id=?",id).get(0).get("version")).longValue();
        if(expected!=actual) throw conflict();return expected;
    }
    private static void changed(int count) { if(count!=1) throw conflict(); }

    private void setting(String key, String value) throws SQLException {
        update("MERGE INTO settings(setting_key,setting_value) KEY(setting_key) VALUES(?,?)",key,value);
    }
    private void exists(String table, long id) throws SQLException {
        // table is an internal constant, never input from an HTTP request.
        if (query("SELECT id FROM " + table + " WHERE id=?",id).isEmpty()) throw invalid("The selected item no longer exists. Refresh and try again.");
    }
    private List<Map<String,Object>> query(String sql, Object... values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, values);
            try (ResultSet result = statement.executeQuery()) {
                List<Map<String,Object>> rows = new ArrayList<>();
                ResultSetMetaData meta = result.getMetaData();
                while (result.next()) {
                    Map<String,Object> row = new LinkedHashMap<>();
                    for (int i=1; i<=meta.getColumnCount(); i++) {
                        Object value = result.getObject(i);
                        if (value instanceof Clob clob) value = clob.getSubString(1, (int)clob.length());
                        if (value instanceof java.sql.Date || value instanceof Timestamp || value instanceof java.sql.Time) value = value.toString();
                        row.put(meta.getColumnLabel(i).toLowerCase(Locale.ROOT),value);
                    }
                    rows.add(row);
                }
                return rows;
            }
        }
    }
    private int update(String sql, Object... values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) { bind(statement,values); return statement.executeUpdate(); }
    }
    private long insert(String sql, Object... values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql,Statement.RETURN_GENERATED_KEYS)) {
            bind(statement,values); statement.executeUpdate();
            try (ResultSet keys = statement.getGeneratedKeys()) { if (!keys.next()) throw new SQLException("No generated key"); return keys.getLong(1); }
        }
    }
    private static void bind(PreparedStatement statement, Object[] values) throws SQLException {
        for (int i=0;i<values.length;i++) statement.setObject(i+1,values[i]);
    }
    private static IllegalArgumentException invalid(String message) { return new IllegalArgumentException(message); }
    private static String required(Map<String,String> form,String key,int max) {
        String value = optional(form,key,max);
        if (value.isBlank()) throw invalid("Please complete " + key.replace('_',' ') + ".");
        return value;
    }
    private static String optional(Map<String,String> form,String key,int max) {
        String value = form.getOrDefault(key,"").trim();
        if (value.length()>max) throw invalid(key.replace('_',' ') + " is too long (maximum " + max + " characters).");
        return value;
    }
    private static String choice(Map<String,String> form,String key,Set<String> choices) {
        String value = required(form,key,120);
        if (!choices.contains(value)) throw invalid("Choose a valid " + key.replace('_',' ') + ".");
        return value;
    }
    private static long id(Map<String,String> form,String key,boolean required) {
        String raw = form.getOrDefault(key,"").trim();
        if (raw.isEmpty() && !required) return 0;
        try { long id = Long.parseLong(raw); if (id>0) return id; } catch (NumberFormatException ignored) { }
        throw invalid("Choose a valid " + key.replace('_',' ') + ".");
    }
    private static String date(Map<String,String> form,String key,boolean required) {
        String value = required ? required(form,key,10) : optional(form,key,10);
        if (value.isEmpty()) return null;
        try { return LocalDate.parse(value).toString(); } catch (Exception e) { throw invalid("Enter a valid " + key.replace('_',' ') + " date."); }
    }

    private void seed() throws SQLException {
        String[][] names = {
            {"Olivia","Bennett","Grade 10","Maple"},{"Liam","Parker","Grade 11","STEM A"},
            {"Emma","Reyes","Grade 9","Cedar"},{"Noah","Santos","Grade 12","HUMSS A"},
            {"Ava","Collins","Grade 10","Oak"},{"Ethan","Cruz","Grade 11","ABM A"},
            {"Sofia","Rivera","Grade 8","Willow"},{"Lucas","Morgan","Grade 12","STEM B"},
            {"Isabella","Torres","Grade 9","Birch"},{"Mason","Lee","Grade 7","Elm"},
            {"Mia","Anderson","Grade 8","Aspen"},{"James","Wilson","Grade 10","Maple"}
        };
        for(int i=0;i<names.length;i++) insert("INSERT INTO students(school_id,first_name,last_name,grade,section_name,email) VALUES(?,?,?,?,?,?)","ST-"+(2026001+i),names[i][0],names[i][1],names[i][2],names[i][3],"");
        String[] titles = {"Building better study habits","College pathway planning","Classroom adjustment check-in","Preparing for university applications","Peer communication follow-up","Exploring career interests","Attendance support plan","Scholarship application support","Finding a study routine","Settling into a new school","Building confidence in class","Subject selection guidance","End-of-term reflection","Study plan review","Group project communication","Transition to senior high"};
        String[] categories = {"Academic","Career","Personal","Career","Behavioral","Career","Attendance","Academic","Academic","Personal","Personal","Academic","Academic","Academic","Behavioral","Career"};
        int[] offsets = {0,1,2,3,5,7,11,15,25,35,50,70,90,110,130,145};
        LocalDate today = LocalDate.now(ZONE);
        for(int i=0;i<titles.length;i++) {
            String status = i>=10 ? "Resolved" : (i%3==0 ? "Open" : "In progress");
            LocalDate opened = today.minusDays(offsets[i]);
            String followup = i<7 ? today.plusDays(i==6 ? -1 : i).toString() : null;
            long record = insert("INSERT INTO guidance_records(student_id,title,category,priority,status,opened_on,follow_up,counselor,summary,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",1+i%12,titles[i],categories[i],i==0||i==6?"High":"Normal",status,opened.toString(),followup,"Jordan Miller","Sample record: Discussed the student's goals and agreed on practical next steps. Review progress at the next check-in.",opened.atTime(10+i%5,15));
            insert("INSERT INTO case_notes(record_id,author,body,created_at) VALUES(?,?,?,?)",record,"Jordan Miller","Sample note: Initial conversation completed. A follow-up plan was agreed with the student.",opened.atTime(10+i%5,15));
        }
        for(int i=0;i<5;i++) insert("INSERT INTO appointments(student_id,title,appointment_date,starts_at,duration,counselor,location_name,notes,status) VALUES(?,?,?,?,?,?,?,?,?)",i+1,i%2==0?"Individual counseling":"Career planning",today.plusDays(i<3?0:i-2).toString(),new String[]{"09:00","10:30","14:00","09:30","11:00"}[i],45,"Jordan Miller","Guidance office","Sample appointment. All student names and records in this workspace are fictional.","Scheduled");
    }

    @Override public synchronized void close() throws SQLException { if (!connection.isClosed()) connection.close(); }
}
