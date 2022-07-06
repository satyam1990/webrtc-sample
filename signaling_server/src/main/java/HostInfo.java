import java.util.ArrayList;
import java.util.List;

public class HostInfo {
    private String name;
    private String sessionDescriptor;
    private List<String> iceCandidates;

    public HostInfo() {
        iceCandidates = new ArrayList<>();
    }

    public void addName(String name) {
        this.name = name;
    }

    public void addSessionDescriptor(String sd) {
        sessionDescriptor = sd;
    }
    public void addIceCandidate(String candidate) {
        iceCandidates.add(candidate);
    }

    public String getSessionDescriptor() {
        return sessionDescriptor;
    }

    public List<String> getIceCandidates() {
        return iceCandidates;
    }

    public String getName() { return name; }
}
