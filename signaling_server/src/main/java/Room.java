import java.util.HashMap;
import java.util.Map;

public class Room {

    // mapping of hostname to HostInfo(SDP and ICE Candidates for all hosts in this room
    private Map<String, HostInfo> hostMap;

    private String roomName;

    public Room(String name) {

        hostMap = new HashMap<>();
        this.roomName = name;
    }

    public HostInfo addHost(String host) {
        HostInfo info = new HostInfo();
        hostMap.put(host, info);
        info.addName(host);

        return info;
    }

    public String getName() { return roomName; }

    public HostInfo getHostInfo(String name) {
        return hostMap.get(name);
    }

    public HostInfo getPeerInfo(String key) {
        HostInfo peer = null;
        for (String name : hostMap.keySet()) {
            if (!name.equals(key)) {
                System.out.println("Host: " + name + " Key: " + key);
                peer = hostMap.get(name);
                break;
            }
        }

        return peer;
    }
}
