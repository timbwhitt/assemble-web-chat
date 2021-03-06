/*
This file is part of Assemble Web Chat.

Assemble Web Chat is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Assemble Web Chat is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Assemble Web Chat.  If not, see <http://www.gnu.org/licenses/>.
*/

var socket = io("", {reconnectionDelayMax:1000, reconnectionDelay:500, timeout: 10000000, multiplex:false});
var rooms = {};
var roomnames = {};
var cur_room = "";
var cur_dur = "48h";
var token = window.location.hash.substring(1);
var newMsgCount=0;
var switchOnJoin = true;
var hasJoined = false;
var enableSound = true;

//load settings from local
if (storageAvailable('localStorage')) {
    if (localStorage.getItem("enableSound"))
        enableSound = localStorage.getItem("enableSound") == "true";
    if (localStorage.getItem("cur_dur"))
        cur_dur = localStorage.getItem("cur_dur");
} else {
    //console.log("No local storage");
}

//socket events
socket.on('connect', auth);
//socket.on('reconnect', auth);
function auth(d) {
    rooms={};
    roomnames={};
    updateSidebar();
    setTimeout(function(){
        socket.emit("auth", token);
    }, 250);
}
socket.on('disconnect', function(d) {
    $(".connecting").removeClass("hidden");
    hasJoined=false;
});

socket.io.on('connect_timeout', function(e) {
    console.log("socket timeout");
    console.log(e);
});
socket.io.on('connect_error', function(e) {
    console.log("socket error");
    console.log(e);
});
socket.io.on('reconnect_error', function(e) {
    console.log("socket reconnect error");
    console.log(e);
});



$(document).ready(function(){
    $( window ).resize(function() {
        updateSidebar();
    });

    $ ( window ).on('keydown', function(ev) {
        if (ev.keyCode == 40 && ev.ctrlKey) { //down
            var troom = $("#sidebar li[data-room='"+cur_room+"']").next().attr("data-room");
            if (typeof troom!="undefined") {
                switchRoom(troom);
            }
            ev.preventDefault();
            return false;
        } else if (ev.keyCode == 38 && ev.ctrlKey) { //up
            var troom = $("#sidebar li[data-room='"+cur_room+"']").prev().attr("data-room");
            if (typeof troom!="undefined") {
                switchRoom(troom);
            }
            ev.preventDefault();
            return false;
        }
    });

    for (var x in icon_lib) { //its okk that these double. it'll only load once anyway
        var ic=$("<img>").attr("src","/icons/"+icon_lib[x]).attr("title", x);
        $("#iconPreload").append(ic);
        if (x.indexOf("(")==0) {
            $("#iconselect .modal-body").append(ic);
        }
    }

    var myDropZone = new Dropzone("#imgupFile",{
    //$("#imgupFile").dropzone({
        url:"/",
        paramName: "file", // The name that will be used to transfer the file
        maxFilesize: 0.5, // MB
        previewsContainer: $("#preview")[0],
        clickable: true,
        maxFiles:1,
        acceptedFiles: "image/*",
        autoProcessQueue: false,
        thumbnail: function(file, imguri) {
            //console.log(imguri)
            socket.emit('chatm', JSON.stringify({"t": token, "room": cur_room, "m": imguri, "dur":cur_dur}));
        }
    });
    //disable the normal dialog from showing
    $("#imgupFile").on('click',function() {
        //return false;
    });
    $("#imgup").on('click',function() {
        $("#imgupFile").click();
    });

    sendPing();
    function sendPing() {
        socket.emit("ping", JSON.stringify({"t": token}));
        setTimeout(sendPing, 149000);//~2.5 minutes. User timeouts every 5 minutes
        //TODO bandwidth optimize this! probably no need to send a full on token each time.
    }

    resetTitle();
    function resetTitle() {
        if (document.hasFocus() && newMsgCount>0) {
            document.title="Assemble Chat";
            newMsgCount=0;
        }
        setTimeout(resetTitle, 1500);
    }

    timeCalc();
    function timeCalc() {
        $("span.time").each(function(index, el){
            var d = new Date(parseInt($(el).attr('data-time')));
            var fuz = fuzzyTime(d);
            var t = $(el).html();
            if (t!=fuz) {
                $(el).html(fuz);
            }
        });
        setTimeout(timeCalc, 60000);
    }

    $('#enablealerts').on('click', function(e) {
        socket.emit("setalerts", JSON.stringify({"t": token, "enabled": true}));
    });
    $('#disablealerts').on('click', function(e) {
        socket.emit("setalerts", JSON.stringify({"t": token, "enabled": false}));
    });

    $('#enablesound').on('click', function(e) {
        enableSound = true;
        if (storageAvailable('localStorage'))
            localStorage.setItem("enableSound", enableSound);
    });
    $('#disablesound').on('click', function(e) {
        enableSound = false;
        if (storageAvailable('localStorage'))
            localStorage.setItem("enableSound", enableSound);
    });

    $('#btnupdateprofile').on('click', function(e) {
        $('#updateprofilebody').html('<iframe src="/signup/#token='+token+'"></iframe>');
        $('#updateprofile').modal();
    });

    $("#messages").on('click', '.userprofilelink', function(e) {
        socket.emit("userinfo", JSON.stringify({"t": token, "uid": $(e.currentTarget).attr("data-uid")}));
    });

    $("#inviteusertoroom").on('click', function(e) {
        var uid = $(e.currentTarget).attr("data-uid");
        socket.emit("inviteusertoroom", JSON.stringify({"t": token, "uid": uid, "room": cur_room}));
    });

    $("#btndeletemessage").on('click', function(e) {
        var msgid = $("#btndeletemessage").attr("data-msgid");
        requestDeleteMessage(msgid);
    });

    $("#btnleaveroom").on('click', function(e) {
        var rm = $("#btnleaveroom").attr("data-room");
        socket.emit("leave", JSON.stringify({"t": token, "room": rm}));
    });
    $("#btnhideroom").on('click', function(e) {
        var rm = $("#btnhideroom").attr("data-room");
        removeRoom(rm);
    });

    $("#createnewroom").on('click', function(e) {
        var name, isprivate, maxexptime, minexptime;
        name=$("#createroom .roomname").val();
        isprivate=$("#createroom .isprivate:checked").length;
        maxexptime=$("#createroom .maxexptime").val();
        minexptime=$("#createroom .minexptime").val();

        switchOnJoin=true;
        socket.emit("createroom", JSON.stringify({"t": token, "roomname": name, "maxexptime": maxexptime, "minexptime": minexptime, "isprivate": (isprivate!=0)}));

        $("#createroom .roomname").val("");
    });

    $("#sendmessage").on('click', function(e) {
        var uid = $(e.currentTarget).attr("data-uid");
        switchOnJoin=true;
        socket.emit("directmessage",JSON.stringify({"t":token, "uid": uid}));
    });

    $('#messages').on('click', 'a.joinroom', function(ev){
        var rm = $(ev.currentTarget).attr("data-room");
        socket.emit("join", JSON.stringify({"t": token, "roomid": rm}));
        if (typeof rooms[rm]!="undefined") {
            switchRoom(rm);
            updateSidebar();
        } else {
            switchOnJoin=true;
        }
        return false;
    });

    $("#iconselect").on('click', '.modal-body img', function(ev){
        var ic=$(ev.currentTarget).attr("title");
        $("#iconselect").modal('hide');
        if ($("#m").val()=="") {
            $("#m").val(ic);
            $("form").submit();
        } else {
            $("#m").val($("#m").val()+" "+ic);
        }

        $("#m").focus();
        ev.preventDefault();
        return false;
    });

    $('#options .currentduration').change(function(e) {
        cur_dur = $('#options .currentduration').val();
        if (storageAvailable('localStorage'))
            localStorage.setItem("cur_dur", cur_dur);
    });
});

//setup notifications
if ("Notification" in window) {
    if (Notification.permission === "granted") {
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission(function (permission) {
            if (permission === "granted") {
            }
        });
    }
} else {
    window.Notification = {permission:"denied"};
}

$(window).on('beforeunload', function(){
    socket.close();
});

$('form').submit(function(){
    var m = $('#m').val();
    if (m!=""){
        if (m[0]=="/") {
            handleCommand(socket,m);
        } else {
            socket.emit('chatm', JSON.stringify({"t": token, "room": cur_room, "m": m, "dur":cur_dur}));
            $('#m').val('');
            $("#m").prop('disabled', true);
        }
    }
    return false;
});
var makeline = true;
$("#m").on('keydown', function(ev) {
    if (ev.keyCode==13) {
        if (ev.shiftKey) {
            if(makeline){
                $("#m").val($("#m").val()+"\n");
                makeline = false;
            }
        } else {
            $('form').submit();
            ev.preventDefault();
            return false;
        }
    }
});

$("#m").on('keyup',function(ev){
    if (ev.keyCode == 13){
        makeLine=true;
    }
});
//menu buttons.
$("#btnroomlist").on('click', function() {
    socket.emit("roomlist",JSON.stringify({"t": token}));
});
$("#btncreateroom").on('click', function() {
    $("#createroom").modal();
});
/*$("#btnduration").on('click', function() {
    $("#messageduration").modal();
});*/
$("#btnoptions").on('click', function() {
    $("#options").modal();
});
$("#btninvitenewuser").on('click', function() {
    var emm=prompt("Enter a message for the invited user (optional):");
    if (typeof emm!="undefined")
        socket.emit("invitenewuser", JSON.stringify({"t": token, "email": emm}));
});
$("#btnuserlist").on('click', function() {
    socket.emit("onlineusers",JSON.stringify({"t": token}));
});
$("#btnroomusers").on('click', function() {
    socket.emit("roomusers",JSON.stringify({"t": token, "room": cur_room}));
});

socket.on('chatm', function(d){
    d=JSON.parse(d);
    appendChatMessage(d.uid,d.room,d.name,d.nick,d.m,d.msgid,d.avatar,d.time);
    scrollToBottom();
    if ($("#m").prop('disabled')==true) {
        $("#m").prop('disabled', false);
        $("#m").focus();
    }
    $("#m").prop('disabled', false);

    if (!document.hasFocus() && enableSound) {
        $("#sfxbeep")[0].play();
    }
    if (!document.hasFocus()) {
        newMsgCount++;
        document.title = "("+newMsgCount+") "+rooms[d.room].friendlyname;
    }

    try {
        if (Notification.permission==="granted" && (cur_room!=d.room || !document.hasFocus()) && d.m.indexOf("data:image/")!=0) {
            var notification = new Notification(d.nick+": "+($("<div/>").html(d.m).text().substring(0,256))+" ["+d.name+"]");
            setTimeout(function() {
                notification.close();
            },7000);
        }
    }catch (err) {
        console.log(err);
    }

    if (cur_room!=d.room) {
        rooms[d.room].mcount++;
        updateSidebar();
    }
});

socket.on('setalerts', function(msg) {
    appendSystemMessage(msg, 30000)
});

socket.on('leave', function(room) {
    removeRoom(room);
});

function removeRoom(room) {
    delete rooms[room];
    for (var n in roomnames) {
        if (roomnames[n]==room) {
            delete roomnames[n]
            break;
        }
    }
    $("#sidebar li[data-room='"+room+"']").remove();
}

socket.on('inviteusertoroom', function(d) {
    var d=JSON.parse(d);
    var m = "<span class='prefix'>You've been invited to join </span>";
    m+="<a class='joinroom' data-room='"+d.room+"'>"+d.name+"</a>";
    m+="<div class='clearfloat'></div>";
    appendSystemMessage(m, 0);
    scrollToBottom();
});

socket.on('userinfo', function(d) {
    var d=JSON.parse(d);

    $("#userprofile .avatar").html("<img src='"+d.avatar+"'></img>");
    $("#userprofile .nick").text(d.nick);
    $("#userprofile .name").text(d.name);
    $("#userprofile .email").text(d.email);
    $("#userprofile .phone").text(d.phone);
    $("#userprofile .url").text(d.url);
    $("#userprofile .desc").html(d.desc);
    $("#inviteusertoroom").attr("data-uid",d.uid);
    $("#sendmessage").attr("data-uid",d.uid);

    $("#userprofile").modal();
})

socket.on('roomusers', function(d) {
    var d=JSON.parse(d);
    var m = "<span class='prefix'>Users in this room: </span>";
    for (var i=0; i<d.uids.length; i++) {
        if (d.online[i])
            m+="<a class='userprofilelink onlineuser' data-uid='"+d.uids[i]+"'>"+d.nicks[i]+"</a>";
        else
            m+="<a class='userprofilelink onlineuser offline' data-uid='"+d.uids[i]+"'>"+d.nicks[i]+"</a>";
    }
    m+="<div class='clearfloat'></div>";
    $('#messages li.userlist').slideUp(500);
    appendSystemMessage(m,0,'userlist');
    scrollToBottom();
});

socket.on('onlineusers', function(d) {
    var d=JSON.parse(d);
    var m = "<span class='prefix'>Total Online Users: </span>";
    for (var i=0; i<d.uids.length; i++) {
        m+="<a class='userprofilelink onlineuser' data-uid='"+d.uids[i]+"'>"+d.nicks[i]+"</a>";
    }
    m+="<div class='clearfloat'></div>";
    $('#messages li.userlist').slideUp(500);
    appendSystemMessage(m,0,'userlist');
    scrollToBottom();
});

socket.on('roomlist', function(d){
    var d=JSON.parse(d);
    var m = "<span class='prefix'>Room List: </span>";
    for (var k in d) {
        m+="<a class='joinroom' data-room='"+k+"'>"+d[k]+"</a>";
    }
    m+="<div class='clearfloat'></div>";
    $('#messages li.roomlist').slideUp(500);
    appendSystemMessage(m, 0, 'roomlist');
    scrollToBottom();
});

socket.on('history', function(d){
    if (!hasJoined) {
        setJoined();
    }

    var d=JSON.parse(d);
    //console.log(d);
    for (var i=0; i<d.history.length; i++) {
        appendChatMessage(d.history[i].uid,d.room,d.name,d.history[i].nick,d.history[i].m,d.history[i].msgid, d.history[i].avatar,d.history[i].time);
    }

    updateSidebar();
    scrollToBottom();
});

socket.on('join', function(d){
    var d=JSON.parse(d);
    if (d.minexptime.indexOf("h0m")!=-1) {
        d.minexptime = d.minexptime.replace("0m","");
        d.minexptime = d.minexptime.replace("0s","");
    }
    if (d.minexptime.indexOf("m0s")!=-1)
        d.minexptime = d.minexptime.replace("0s","");
    if (d.maxexptime.indexOf("h0m")!=-1) {
        d.maxexptime = d.maxexptime.replace("0m","");
        d.maxexptime = d.maxexptime.replace("0s","");
    }
    if (d.maxexptime.indexOf("m0s")!=-1)
        d.maxexptime = d.maxexptime.replace("0s","");

    if (!(d.name in roomnames)) {
        rooms[d.room] = {users: [], messages: [], friendlyname: d.name, mcount: 0, minexptime: d.minexptime, maxexptime: d.maxexptime};
        roomnames[d.name] = d.room;
        if (d.room=="lobby" || switchOnJoin) {
            switchRoom(d.room);
            switchOnJoin=false;
        }
        var t = (new Date()).getTime()/1000;
        appendChatMessage("", d.room, d.name, "<em>SYSTEM</em>", "Joined "+d.name+" ("+d.minexptime+" - "+d.maxexptime+")", "", "/icons/icon_important.svg", t);
        socket.emit("history",JSON.stringify({"t": token, "room": d.room}));   //request history
    } else if (hasJoined) {
        setJoined();
    }
    updateSidebar();
});

socket.on('joined', function(d){
    var d=JSON.parse(d);
    appendSystemMessage(d.nick +" joined "+d.name, 3000);
    rooms[d.room].users.push({uid:d.uid, nick:d.nick});
});

socket.on('auth_error', function(d){
    appendSystemMessage("Error: "+d,5000);
    if (d=="Invalid Token") {
        appendSystemMessage("<a class='signup' href='/signup'>Sign up with your Invite Code</a>",0);
        $(".connecting").addClass("hidden");
    }
    $("#m").prop('disabled', false);
});

socket.on('auth', function(d){
    appendSystemMessage("Logged in successfully",3000);
});

socket.on('invitenewuser', function(d){
    var d=JSON.parse(d);
    appendSystemMessage("Invite Key: "+d.key+" <a href='/signup/#"+d.key+"'>(signup link)</a>",0);
});

socket.on('deletechatm', function(d){
    $("#messages li[data-msgid='"+d+"']").html("<i>Removed message</i>");
    setTimeout(function(){
        $("#messages li[data-msgid='"+d+"']").slideUp(1000);
    }, 3000);
});

function setJoined() {
    $(".connecting").addClass("hidden");
    $("#m").focus();
    hasJoined=true;
}

function updateSidebar() {
    //update sidebar to hold message counts and list active chat rooms
    for (var r in rooms) {
        var rm = rooms[r];
        if ($("#sidebar li[data-room='"+r+"']").length == 0) {
            $("#sidebar").append($("<li>")
                .attr("data-room", r)
                .attr("title", rm.minexptime+" - "+rm.maxexptime)
                .html("<div>"+rm.friendlyname+"</div><span></span>")
                .on('click', function(ev) {
                    var rm = $(ev.currentTarget).attr("data-room");
                    switchRoom(rm);
                })
                .on('contextmenu', function(ev) {
                    var rm = $(ev.currentTarget).attr("data-room");
                    //socket.emit("leave", JSON.stringify({"t": token, "room": rm}));
                    $("#btnleaveroom").attr("data-room", rm);
                    $("#btnhideroom").attr("data-room", rm);
                    $("#leaveroommodal").modal();
                    return false;
                })
            );
        }

        if (rm.mcount > 0) {
            $("#sidebar li[data-room='"+r+"'] span").html(rm.mcount);
        } else {
            $("#sidebar li[data-room='"+r+"'] span").text("");
        }
        if (r == cur_room) {
            $("#sidebar li.active").removeClass("active");
            $("#sidebar li[data-room='"+r+"']").addClass("active");
        }
    }
    $("#sidebar").css("height", (window.innerHeight-42)+"px");
}

function scrollToBottom() {
    $(window).scrollTop($('body')[0].scrollHeight);
}

function appendSystemMessage(msg, lifetimeMs, cssclass) {
    if (typeof cssclass=="undefined")
        cssclass="";

    var sm = $('<li>').addClass("sysmsg").addClass(cssclass).html(msg);
    $('#messages').append(sm);
    if (lifetimeMs>0) {
        setTimeout(function(){
            sm.slideUp(1000);
        }, lifetimeMs);
    }
}

function appendChatMessage(uid, room, roomname, nick, m, id, avatar, time) {
    var hide = "";
    if (room!=cur_room) {
        hide="hidden";
    }

    var tmp = $('<div>')
    tmp.text(m);
    m=tmp.text();
    //TODO needs escaping

    if (m.indexOf("data:image/")==0) {
        m = "<img class='autolink upload' src='"+m+"'></img>";
    } else {
        m = Autolinker.link(m, {
            stripPrefix: false,
            truncate: 30,
            className:"autolink",
            twitter:false,
            hashtag: false,
            replaceFn : function( autolinker, match ) {
                href = match.getAnchorHref();
                switch( match.getType() ) {
                    case 'url' :
                        if ( match.getUrl().indexOf( '.jpg' ) !== -1 ||
                             match.getUrl().indexOf( '.jpeg' ) !== -1 ||
                             match.getUrl().indexOf( '.png' ) !== -1 ||
                             match.getUrl().indexOf( '.gif' ) !== -1  )
                        {
                            return "<a href='"+href+"' target='_blank'>"+href+"</a><br><img src='"+href+"' class='autolink'></img>";
                        }
                        else if ( match.getUrl().indexOf( '.mp4' ) !== -1 ||
                             match.getUrl().indexOf( '.ogg' ) !== -1 ||
                             match.getUrl().indexOf( '.webm' ) !== -1 )
                        {
                            return "<a href='"+href+"' target='_blank'>"+href+"</a><br><video controls class='autolink'><source src='"+href+"'></video>";
                        }
                        else if ( match.getUrl().indexOf('youtube.com/watch?v=') !== -1 )
                        {
                            //<iframe width="560" height="315" src="https://www.youtube.com/embed/U3pXNt7zqIU" frameborder="0" allowfullscreen></iframe>
                            var frame = '<iframe class="autolink" height="315" src="'+match.getUrl().replace('youtube.com/watch?v=', 'youtube.com/embed/')+'" frameborder="0" allowfullscreen></iframe>';
                            return frame;
                        }
                        break;
                }
                return;
            }
        });

        m = m.split("\n").join("<br>");

        //icons
        m = processIcons(m);
    }

    if (avatar=="" || typeof avatar=="undefined") {
        avatar = "";
    }

    var rawtime=time*1000;
    if (typeof time=="undefined") {
        time="";
    } else {
        time = fuzzyTime(new Date(time*1000));
    }

    var avatarimg = "<img src='"+avatar+"' class='avatar'></img>";
    if (avatar=="") {
        avatarimg = "<span class='glyphicon glyphicon-user avatar'></span>";
    }

    $('#messages').append($('<li>')
        .html("<div class='useravatar'>"+avatarimg+"</div><div class='messagecontainer'><a title='"+uid+"' data-uid='"+uid+"' class='userprofilelink nick'>"+nick+"</a> <span class='time' data-time='"+rawtime+"'>"+time+"</span> <br><span class='messagetext'>"+m+"</span>")
        .attr("data-msgid", id)
        .attr("data-room", room)
        //.attr("title",id)
        .addClass("chatmsg")
        .addClass(hide)
        .on("contextmenu",function(ev) {
            var msgid = $(ev.currentTarget).attr("data-msgid")
            $("#btndeletemessage").attr("data-msgid", msgid);
            $("#deletemessagemodal").modal();
            return false;
        })
        /*
        .on("click", function(ev) {
            console.log("Show user info"); //TODO
        })
        */
    );
}

function processIcons(m) {
    for (var x in icon_lib) {
        if (m==x){
            m='<img src="/icons/'+icon_lib[x]+'" class="smiley large" />';
        }
        m=m.split(x).join('<img src="/icons/'+icon_lib[x]+'" class="smiley" />');
        //needs to be smarter about where it does replacements?
    }
    return m;
}

function requestDeleteMessage(msgid) {
    socket.emit("deletechatm", JSON.stringify({
        "t": token,
        "room": cur_room,
        "msgid": msgid
    }));
}

function switchRoom(room) {
    if (room!="lobby") {
        $("#messages li.sysmsg").hide();
    }

    if (typeof rooms[room]=="undefined") {
        appendSystemMessage("Unknown room", 5000);
    } else {
        cur_room = room;
    }

    $("#messages li.chatmsg").addClass("hidden");
    $("#messages li.chatmsg[data-room='"+cur_room+"']").removeClass("hidden");

    rooms[cur_room].mcount = 0;

    updateSidebar();
    scrollToBottom();
    $("#m").focus();
}

function switchRoomByName(roomname) {
    var new_room = roomnames[roomname];
    if (new_room==null || typeof roomnames[roomname]=="undefined") {
        appendChatMessage("","lobby", "Lobby", "SYSTEM", "Unknown room", "");
    } else {
        switchRoom(new_room);
    }
}

//TODO make a better fuzzer
function fuzzyTime( previous) {
    current = new Date();
    var msPerMinute = 60 * 1000;
    var msPerHour = msPerMinute * 60;
    var msPerDay = msPerHour * 24;
    var msPerMonth = msPerDay * 30;
    var msPerYear = msPerDay * 365;

    var elapsed = current - previous;

    if (elapsed < msPerMinute) {
        return "";
    } else if (elapsed < msPerHour) {
        return Math.round(elapsed/msPerMinute) + ' minutes ago';
    } else if (elapsed < msPerDay ) {
        return Math.round(elapsed/msPerHour ) + ' hours ago';
    } else if (elapsed < msPerMonth) {
        //return Math.round(elapsed/msPerDay) + ' days ago';
        return previous.toLocaleDateString()
    } else if (elapsed < msPerYear) {
        //return Math.round(elapsed/msPerMonth) + ' months ago';
        return previous.toLocaleDateString()
    } else {
        //return Math.round(elapsed/msPerYear ) + ' years ago';
        return previous.toLocaleDateString()
    }
}

function handleCommand(socket,c) {
    var ca = c.split(" ");
    switch (ca[0]) {
        case "/help":
            appendSystemMessage(" \
                /leave - Leaves the current room <br>\
                /ban admin uid - Bans the UID permanently <br>\
                /unban admin uid - UnBans the UID <br>\
                /dur message-duration - Sets your message expiration time (ie: 24h, 10m, 30s, etc) <br>\
                /join room-name - Attempts to join a room by name <br>\
                /switch room-name - Switches your chat focus to a room by name <br>\
                /roomlist - Lists all public rooms with links to join <br>\
            ", 0);
            break;
        case "/leave":
            socket.emit("leave", JSON.stringify({"t": token, "room": cur_room}));
            break;
        case "/ban":
            var pass = ca[1];
            var uid = ca[2];
            socket.emit("ban", JSON.stringify({"t": token, "pass": pass, "uid": uid}));
            break;
        case "/unban":
            var pass = ca[1];
            var uid = ca[2];
            socket.emit("unban", JSON.stringify({"t": token, "pass": pass, "uid": uid}));
            break;
        case "/dur":
            var dur = ca[1];
            cur_dur = dur;
            break;
        case "/join":
            var roomname = c.substring(6);
            socket.emit("join", JSON.stringify({"t": token, "roomname": roomname}));
            break;
        case "/switch":
            var roomname = c.substring(8);
            switchRoomByName(roomname);
            updateSidebar();
            break;
        case "/roomlist":
            socket.emit("roomlist",JSON.stringify({"t": token}));
            break;
        case "/onlineusers":
            socket.emit("onlineusers",JSON.stringify({"t": token}));
            break;
        default:
            appendSystemMessage("Unknown command", 3000);
            break;
    }
    $('#m').val('');
}


function storageAvailable(type) {
	try {
		var storage = window[type],
			x = '__storage_test__';
		storage.setItem(x, x);
		storage.removeItem(x);
		return true;
	}
	catch(e) {
		return false;
	}
}

var icon_lib = {
    ">:|":"icon_angry.svg",
    ">:(":"icon_angry.svg",
    ":D":"icon_bigsmile.svg",
    ":-D":"icon_bigsmile.svg",
    ":$":"icon_blush.svg",
    ":-$":"icon_blush.svg",
    "o.O":"icon_confused.svg",
    "O.o":"icon_confused.svg",
    "O_o":"icon_confused.svg",
    "o_O":"icon_confused.svg",
    "8-)":"icon_cool.svg",
    ";(":"icon_cry.svg",
    ":'(":"icon_cry.svg",
    ";-(":"icon_cry.svg",
    "(important)":"icon_important.svg",
    ":*":"icon_kiss.svg",
    "X-D":"icon_lol.svg",
    ":|":"icon_neutral.svg",
    ":-|":"icon_neutral.svg",
    ":(":"icon_sad.svg",
    ":-|":"icon_neutral.svg",
    ":-(":"icon_sad.svg",
    ":-#":"icon_sick.svg",
    ":)":"icon_smile.svg",
    ":-)":"icon_smile.svg",
    ":O":"icon_surprised.svg",
    ":-O":"icon_surprised.svg",
    "(thinking)":"icon_think.svg",
    ":P":"icon_tongue.svg",
    ":-P":"icon_tongue.svg",
    "(twisted)":"icon_twisted.svg",
    ";)":"icon_wink.svg",
    ";-)":"icon_wink.svg",

    "(angry)":"icon_angry.svg",
    "(bigsmile)":"icon_bigsmile.svg",
    "(blush)":"icon_blush.svg",
    "(confused)":"icon_confused.svg",
    "(shades)":"icon_cool.svg",
    "(cry)":"icon_cry.svg",
    "(kiss)":"icon_kiss.svg",
    "(lol)":"icon_lol.svg",
    "(neutral)":"icon_neutral.svg",
    "(sad)":"icon_sad.svg",
    "(sick)":"icon_sick.svg",
    "(smile)":"icon_smile.svg",
    "(surprised)":"icon_surprised.svg",
    "(tongue)":"icon_tongue.svg",
    "(wink)":"icon_wink.svg",
    "(y)":"icon_thumbsup.svg",
    "(n)":"icon_thumbsdown.svg",
};
