import javax.json.*;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.io.StringReader;
import java.util.HashMap;
import java.util.Map;

@Path("/room")
public class RoomManager {

    private static Map<String, Room> roomMap;

    static {
        roomMap = new HashMap<>();
    }

    public RoomManager() {
    }

    @POST
    @Path("/create")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response create(String json, @Context HttpServletRequest req) {

        // handle new room create request
        createRoom(json, req.getRemoteAddr());

        return Response.ok("Accepted").build();
    }

    @DELETE
    @Path("/remove/{name}")
    public Response remove(@PathParam("name") String name) {

        roomMap.remove(name);
        System.out.println("Room Deleted: " + name);

        return Response.ok("Room Deleted: " + name).build();
    }

    @POST
    @Path("/icecandidate")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response iceCandidate(String json, @Context HttpServletRequest req) {

        // handle add new ICE Candidate for a host in a specific room
        addIceCandidate(json, req.getRemoteAddr());

        return Response.ok("Accepted").build();
    }

    @POST
    @Path("/join")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response join(String json, @Context HttpServletRequest req) {

        // handle the other peer's room join request
        if (!joinRoom(json, req.getRemoteAddr()))
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Room not Exists").build();

        return Response.ok("Accepted").build();
    }

    @GET
    @Path("/{name}/{hostId}/peerSessionInfo")
    @Produces(MediaType.APPLICATION_JSON)
    public Response peerInfo(@PathParam("name") String roomName,
                             @PathParam("hostId") String hostId,
                             @Context HttpServletRequest req) {

        // get peers session descriptor and ICE Candidates
        HostInfo peer = getPeerInfo(roomName, hostId, req.getRemoteAddr());
        if (peer == null) {
            JsonObjectBuilder objectBuilder = Json.createObjectBuilder();
            objectBuilder.add("name", "");
            objectBuilder.add("sdp", "");
            objectBuilder.add("candidates", "");
            return Response.ok().entity(objectBuilder.build()).build();
        }

        // We need MediaWriter if we have to do as below
        // MediaWriter jar will convert object to JSON
        // return Response.ok().entity(peer).build();

        // json convert manually
        JsonObjectBuilder objectBuilder = Json.createObjectBuilder();
        objectBuilder.add("name", peer.getName());
        objectBuilder.add("sdp", peer.getSessionDescriptor());

        JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();

        for (String candidate : peer.getIceCandidates()) {
            arrayBuilder.add(candidate);
        }
        JsonArray candidatesArray = arrayBuilder.build();

        objectBuilder.add("candidates", candidatesArray);

        return Response.ok().entity(objectBuilder.build()).build();
    }

    private HostInfo getPeerInfo(String roomName, String hostId, String host) {

        HostInfo peer = null;

        Room room = roomMap.get(roomName);
        if (room == null)
            return null;

        // peer is the one which is not having this host as key
        String key = host + hostId;
        System.out.println("Host: " + key + " fetching peer info");

        return room.getPeerInfo(key);
    }

    private boolean joinRoom(String json, String host) {
        JsonReader reader = Json.createReader(new StringReader(json));
        JsonObject joinRoomReq = reader.readObject();

        int hostUniqueId = joinRoomReq.getInt("id");
        String roomName = joinRoomReq.getString("name");
        String sessionDescriptor = joinRoomReq.getString("sdp");

        String hostname = host + hostUniqueId;
        Room room = roomMap.get(roomName);
        if (room == null)
            return false;

        HostInfo hostInfo = getHostInfo(room, hostname);

        hostInfo.addSessionDescriptor(sessionDescriptor);
        System.out.println("Host: " + hostname + " Joined room: " + roomName);

        return true;
    }

    private void addIceCandidate(String json, String host) {
        JsonReader reader = Json.createReader(new StringReader(json));
        JsonObject addCandidateReq = reader.readObject();

        int hostUniqueId = addCandidateReq.getInt("id");
        String roomName = addCandidateReq.getString("name");
        String candidate = addCandidateReq.getString("candidate");

        String hostname = host+hostUniqueId;

        // get room
        Room room = getRoom(roomName);

        // get the host details whose candidate add request came
        HostInfo hostInfo = getHostInfo(room, hostname);

        // add the ICE candidate
        hostInfo.addIceCandidate(candidate);
        System.out.println("ICE Candidate Added: " + candidate + " for host: "
                + hostname + " in room: " + roomName);
    }

    private void createRoom(String json, String host) {
        JsonReader reader = Json.createReader(new StringReader(json));
        JsonObject addCandidateReq = reader.readObject();

        int hostUniqueId = addCandidateReq.getInt("id");
        String roomName = addCandidateReq.getString("name");
        String sessionDescriptor = addCandidateReq.getString("sdp");

        String hostname = host+hostUniqueId;

        Room room = getRoom(roomName);

        // get the host details whose session descriptor add request came
        HostInfo hostInfo = getHostInfo(room, hostname);

        // add the Session Descriptor
        hostInfo.addSessionDescriptor(sessionDescriptor);
        System.out.println("Session Descriptor Added: " + sessionDescriptor + " for host: " +
                hostname + " in room: " + roomName);
    }

    private Room getRoom(String roomName) {
        synchronized (roomMap) {
            Room room = roomMap.get(roomName);
            if (room != null) {
                System.out.println("Returning Exiting Room");
                return room;
            }

            System.out.println("Creating Room: " + roomName);

            // create the room and add to the map
            room = new Room(roomName);
            roomMap.put(roomName, room);

            return room;
        }
    }

    private HostInfo getHostInfo(Room room, String hostname) {
        synchronized (roomMap) {
            HostInfo info = room.getHostInfo(hostname);
            if (info != null) {
                System.out.println("Returning already existing HostInfo");
                return info;
            }

            System.out.println("Creating HostInfo for " + hostname + " in room " + room.getName());
            return room.addHost(hostname);
        }
    }
}
