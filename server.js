
 var port = 1000;
const { Socket } = require('dgram');
 var express = require('express');
 var app = express();
 var server = require('http').createServer(app);
 var io = require('socket.io')(server);

 //helper file call 
 const {debuglog,timestamp} = require('./utils/helper');

 //Server port specifing
 server.listen(port,function (){
     console.log('Server running at port ', port);
 });

 //middleware stting 
 app.use(express.static(__dirname+ '/'));

 //Global variable declaration
var sockets ={},
    users = {},
    strangerQueue = false,
    peopleActive = 0,
    peopleTotal = 0,
    strangerName1='',
    strangerName2='';

//function timestamp () {
 //   var time = new Date();
  //  return(time.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }));
//}


 io.sockets.on('connection', (socket)=>{
 
    socket.on('strangerName',(strangerName)=>{
        debuglog('A new User['+strangerName+'] got connected');

        //store the socket and the info about current user
        sockets[socket.id]=socket;
        users[socket.id]={
            connectedTo:-1,
            isTyping:false,
            userName:strangerName
        };

        //Connecting Two Strangers
        if(strangerQueue !== false){
            users[socket.id].connectedTo=strangerQueue;
            users[socket.id].isTyping=false;
            users[strangerQueue].connectedTo=socket.id;
            users[strangerQueue].isTyping=false;

            strangerName1 = users[strangerQueue].userName;
            strangerName2 = users[socket.id].userName;

            socket.emit('conn',strangerName1);
            sockets[strangerQueue].emit('conn',strangerName2);
            strangerQueue=false;
        }else{
            strangerQueue = socket.id;
        }

        peopleActive++;
        peopleTotal++;
        debuglog('Total users :'+peopleTotal);

        for (const [key, value] of Object.entries(users)) {
            console.log(`${key}: ${value.userName}`);
          }

         io.sockets.emit('state',{people : peopleActive}); 

    });

    //It will work from second chat request
    socket.on('new',()=>{
        if(strangerQueue !== false){
            users[socket.id].connectedTo = strangerQueue;
            users[strangerQueue].connectedTo = socket.id;
            users[socket.id].isTyping = false;
            users[strangerQueue].isTyping = false;

            strangerName1 = users[strangerQueue].userName;
            strangerName2 = users[socket.id].userName;

            socket.emit('conn', strangerName1);
            sockets[strangerQueue].emit('conn', strangerName2);
            strangerQueue = false;
        }else{
            strangerQueue = socket.id;
        }
        peopleActive++;
        io.sockets.emit('state', {people : peopleActive});
    });

    //Disconnect request from User
    socket.on('disconn',()=>{
       var connTo = users[socket.id].connectedTo;
       if (strangerQueue === socket.id || strangerQueue === connTo){
           strangerQueue = false;
       }

       users[socket.id].connectedTo = -1;
       users[socket.id].isTyping = false;
       if(sockets[connTo]){
           users[connTo].connectedTo = -1;
           users[connTo].isTyping = false;
           strangerName1 = users[socket.id].userName;
           sockets[connTo].emit('disconn',{who : 2, stranger : strangerName1});
           debuglog('Disconnect initiated by '+strangerName1);
       }
       socket.emit('disconn', {who : 1, stranger : ''});
       peopleActive -= 2;
       io.sockets.emit('state',{people : peopleActive});
    });

    //Getting chat msg from one stranger then sharing it to another stranger
    socket.on('chat', (mesg)=>{
        if(users[socket.id].connectedTo !== -1 && sockets[users[socket.id].connectedTo]){
            var msgFrom = users[socket.id].userName;
            console.log('message new :'+timestamp());
            sockets[users[socket.id].connectedTo].emit('chat', {msg : mesg.msg, msgType : mesg.msgType, nameFrom : msgFrom});
        }
    });

    //Getting typing nodification from one stranger then passing it to opponent stranger
    socket.on('typing', (isTyping)=>{
        if(users[socket.id].connectedTo !== -1 && sockets[users[socket.id].connectedTo] && users[socket.id].isTyping !== isTyping){
            users[socket.id].isTyping = isTyping;
            var whoTypeing = users[socket.id].userName;
            sockets[users[socket.id].connectedTo].emit('typing', {stat : isTyping, name : whoTypeing});
        }
    });

    //Unexpected disconnect handler like browser refresh
    socket.on('disconnect', (err)=>{
        
        var connTo = (users[socket.id] && users[socket.id].connectedTo);
        if (connTo === undefined){
            connTo = -1;
        }

        if(connTo !== -1 && sockets[connTo]){
            strangerName1 = users[socket.id].userName;
            debuglog('Connection disconnected Unexpectedly...By '+strangerName1+' side');
            sockets[connTo].emit("disconn", {who : 2, stranger : strangerName1, reason : err && err.toString()});
            users[connTo].connectedTo = -1;
            users[connTo].isTyping = false;
            peopleActive -= 2;
        }

        delete sockets[socket.id];
        delete users[socket.id];

        if(strangerQueue === socket.id || strangerQueue === connTo){
            strangerQueue = false;
            peopleActive--;
        }

        peopleTotal--;
        io.sockets.emit('state',{people : peopleActive});
    });

 }) ;  