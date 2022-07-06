let c1 = document.querySelector('#createBtn');
let j1 = document.querySelector('#joinBtn');
let createRoomDiv = document.querySelector('#createRoomDiv');
let joinRoomDiv = document.querySelector('#joinRoomDiv');
let clientId = Math.floor((Math.random() * 99999) + 1);

// Signaling server details
let signaling_host = "http://localhost:8080";

const sleep = ms => new Promise(r => setTimeout(r, ms));

// show the create room div
c1.onclick = function() {
	joinRoomDiv.setAttribute('hidden', true);
	createRoomDiv.removeAttribute('hidden');
}

// show the join room div
j1.onclick = function() {
	createRoomDiv.setAttribute('hidden', true);
	joinRoomDiv.removeAttribute('hidden');
}

// DOM elements
let createRoom = document.querySelector('#createRoom');
let joinRoom = document.querySelector('#joinRoom');
let endCall = document.querySelector('#endCall');
let roomName = document.querySelector('#createRoomText');
let joinRoomName = document.querySelector('#joinRoomText');
let localVideoElement = document.querySelector('#localVideo');
let peerVideoElement = document.querySelector('#peerVideo');

let localStream = null;

let STUN = {
    'url': 'stun:100.77.48.222:3478',
};

let configuration = 
{
    iceServers: [STUN]
};

let conn = null;
let peerInfo = null;

createRoom.addEventListener('click', startCall);
joinRoom.addEventListener('click', joinCall);
endCall.addEventListener('click', deleteRoom);

async function startCall() {

	// get the room name
	let name = roomName.value;
	if (!name)
		return alert("Room Name Empty!");

	// get the local audio/video stream from respective devices
	localStream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});

	// display local stream on the localVideo element
	localVideoElement.srcObject = localStream;
	createRoomDiv.setAttribute('hidden', true);

	// create RTCPeerConnection
	conn = new RTCPeerConnection(configuration);
	console.log("Created new RTCPeerConnection", conn);

	// define callbacks which will send room name - iceCandidate mapping to the signaling server
	conn.addEventListener('icecandidate', (event) => onIceCandidate(name, event));
	conn.addEventListener('iceconnectionstatechange', (event) => onIceStateChange(event));
    
    // add my audio video track to the connection
    localStream.getTracks().forEach(track => conn.addTrack(track, localStream));

	// create offer
	let offerOptions = {
		offerToReceiveAudio: 1,
		offerToReceiveVideo: 1
	};
	conn.createOffer(offerOptions).then(function(offer) {
		onCreateOfferSuccess(name, offer);
	})
	.catch(function(reason) {
		console.log("Create Offer Error: ", reason);
	});

	// enable the end call button
	endCall.removeAttribute('hidden');
    
	// wait for peer to join
	peerInfo = await waitForPeer(name);
	
	console.log("Adding remote Session Descriptor and ICE Candidates");
	
	// set remote session description
	let remoteSd = new RTCSessionDescription(JSON.parse(peerInfo.sdp));
	await conn.setRemoteDescription(remoteSd);

	// add the ICE candidates
	for (const candidate of peerInfo.candidates) {
    	await conn.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)));
    }
	
	console.log("Added remote Session Descriptor and ICE Candidates");
}


async function waitForPeer(roomName) {

	do {
		$.ajax({ 
			type: 'GET', 
			url: signaling_host + '/signaling_server/webapi/room/' + roomName + '/' + clientId + '/peerSessionInfo',
			success: function (result) {
				peerInfo = result;
				console.log(peerInfo);
			},
			dataType: 'json'
		});
		await sleep(5000);
	} while(peerInfo.name === "");

	return peerInfo;
}

async function onCreateOfferSuccess(name, offer)
{
	await conn.setLocalDescription(offer);
	console.log("Local Description:", offer);
	let data = {id: clientId, name: name, sdp: JSON.stringify(offer)};
	
	// send Session Descriptor to signaling server peer will fetch from there
	$.ajax({ 
		type: 'POST', 
		url: signaling_host + '/signaling_server/webapi/room/create',
		data: JSON.stringify(data),
    	success: function(result) { 
    		console.log('Create Offer Success: ' + result); 
    	},
    	error: function (request, status, error) {
        	console.log('Error: ' + request.responseText);
        	alert(request.responseText);
    	},
    	contentType: "application/json"
    	//dataType: 'json'
	});
}

function onIceCandidate(name, event) {
	if(event.candidate !== null) {
		console.log("Send Candidate to server: ", event.candidate);
		let data = {id: clientId, name: name, candidate: JSON.stringify(event.candidate)}

		// send ICE Candidate to signaling server peer will fetch from there
	$.ajax({ 
		type: 'POST', 
		url: signaling_host + '/signaling_server/webapi/room/icecandidate',
		data: JSON.stringify(data),
    	success: function(result) { 
    		console.log('Success: ' + result); 
    	},
    	error: function (request, status, error) {
        	console.log('Error: ' + request.responseText);
        	alert(result.responseText);
    	},
    	contentType: "application/json"
	});
	}
	else {
		console.log("No more ICE Candidates, Session Created");
	}
}

function onIceStateChange(event) {
	console.log("Ice State Changed to: ", conn.iceConnectionState, event);
}

async function joinCall() {

	// room name user want to join
	let name = joinRoomName.value;
	if (!name)
		alert("Room name empty");

	joinRoomDiv.setAttribute('hidden', true);

	// get peer Info i.e. peer session descriptor and candidates
	peerInfo = await getPeerInfo(name, clientId);	

	// create RTC connection object
	conn = new RTCPeerConnection(configuration);

	// register event handlers
	conn.addEventListener('icecandidate', (event) => onIceCandidate(name, event));
	conn.addEventListener('iceconnectionstatechange', (event) => onIceStateChange(event));
	conn.addEventListener('track', (event) => handleRemoteStream(event));

	// set remote session description
	let remoteSd = new RTCSessionDescription(JSON.parse(peerInfo.sdp));
	await conn.setRemoteDescription(remoteSd);

	// add the ICE candidates
	for (const candidate of peerInfo.candidates) {
    	await conn.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)));
    }

    console.log("Added remote Session Descriptor and ICE Candidates");

	// create answer
	conn.createAnswer().then(function(answer) {
		onCreateAnswerSuccess(name, answer);
	})
	.catch(function(reason) {
		console.log("Create Answer Error: ", reason);
	});

	// enable the end call button
	endCall.removeAttribute('hidden');
}

function getPeerInfo(name, clientId) {
	return new Promise(function(resolve, reject) {
		$.ajax({ 
			type: 'GET', 
			url: signaling_host + '/signaling_server/webapi/room/' + name + '/' + clientId + '/peerSessionInfo',
			success: function(result) {
				peerInfo = result;
				console.log("Got Peer Info: ", peerInfo);
				resolve(result);
			},
			error: function(err) {
				reject(err);
			},
			dataType: 'json'
		});

	});
}

async function onCreateAnswerSuccess(name, answer)
{
	await conn.setLocalDescription(answer);
	console.log("Local Description:", answer);
	let data = {id: clientId, name: name, sdp: JSON.stringify(answer)};
	
	// send Session Descriptor to signaling server peer will fetch from there
	$.ajax({ 
		type: 'POST', 
		url: signaling_host + '/signaling_server/webapi/room/join',
		data: JSON.stringify(data),
    	success: function(result) { 
    		console.log('Create Answer Success: ' + result); 
    	},
    	error: function (request, status, error) {
        	console.log('Error: ' + request.responseText);
        	alert(request.responseText);
    	},
    	contentType: "application/json"
    	//dataType: 'json'
	});
}

function handleRemoteStream(event) {
    console.log("handleRemoteStream called: ", event);
	if (peerVideoElement.srcObject !== event.streams[0]) {
		peerVideoElement.srcObject = event.streams[0];
		console.log("Received Remote Stream");
	}
}

function deleteRoom() {
	let name = "";
	if (roomName.value !== "")
		name = roomName.value;
	else
		name = joinRoomName.value;

	$.ajax({
    	url: signaling_host + '/signaling_server/webapi/room/remove/' + name,
    	type: 'DELETE',
    	success: function(result) {
    		console.log("Room Deleted: ", name);
    	}
	});

	if (localStream) {
		localStream.getTracks().forEach(function(track) {
  			track.stop();
		});
	}

	conn.close();
	
	localVideoElement.srcObject = null;
	peerVideoElement.srcObject = null;

	endCall.setAttribute('hidden', true);

	// stop waiting for peer now
	peerInfo.name = '.';

}
