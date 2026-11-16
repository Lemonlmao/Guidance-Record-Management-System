package guidance;

/** An expected security, integrity, or concurrency failure safe to show to the user. */
public final class SecurityProblem extends RuntimeException {
    private final int status;
    public SecurityProblem(int status, String message) { super(message); this.status=status; }
    public int status() { return status; }
}
