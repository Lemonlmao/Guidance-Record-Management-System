package guidance;

import java.security.*;
import java.util.*;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/** Standard JDK password hashing; no plaintext or reversible account passwords are stored. */
public final class Passwords {
    public static final int ITERATIONS=600_000;
    private static final SecureRandom RANDOM=new SecureRandom();
    private Passwords() { }
    public static byte[] randomBytes(int size) { byte[] bytes=new byte[size];RANDOM.nextBytes(bytes);return bytes; }
    public static String token() { return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes(32)); }
    public static String salt() { return Base64.getEncoder().encodeToString(randomBytes(16)); }
    public static void validate(String password) {
        int length=password.codePointCount(0,password.length());
        if(length<15||length>128) throw new IllegalArgumentException("Use a passphrase of 15–128 characters. Spaces are welcome.");
    }
    public static String hash(String password,String salt,int iterations) {
        char[] chars=password.toCharArray();
        PBEKeySpec spec=new PBEKeySpec(chars,Base64.getDecoder().decode(salt),iterations,256);
        try { return Base64.getEncoder().encodeToString(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded()); }
        catch(GeneralSecurityException error) { throw new IllegalStateException("Password hashing is unavailable.",error); }
        finally { spec.clearPassword();Arrays.fill(chars,'\0'); }
    }
    public static boolean matches(String password,String salt,String expected,int iterations) {
        if(password.length()>512||iterations<ITERATIONS||iterations>2_000_000) return false;
        return MessageDigest.isEqual(Base64.getDecoder().decode(expected),Base64.getDecoder().decode(hash(password,salt,iterations)));
    }
    public static boolean equalTokens(String actual,String expected) {
        return actual!=null&&expected!=null&&MessageDigest.isEqual(actual.getBytes(java.nio.charset.StandardCharsets.US_ASCII),expected.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
    }
}
