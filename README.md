# assemble-chat-server
Assemble is a GPLv3, database-less, full featured html chat system meant to be quick to set up and easy to host. It supports auto-expiration of messages, autoparses links and images and more.

## Features Implemented
* Golang based Https and Socket server
* User token generation/signup (pub/priv segments) and sign-in.
* New user invite process
* Ban/unban system
* In-memory only storage system for chat rooms, history, etc
* Manual message deletion
* User-configurable per-message auto-delete time
* Create/Join Chat Rooms
* List public chat rooms
* Phone friendly, Tablet friendly UI
* Auto-process message content for links, image embeds, etc
* User avatars
* Image uploads in messages
* Unread / new messages
* Desktop notifications API
* List of users in a room & online status
* Invite to chat rooms
* Ui dialogs for create-room/msg-duration
* Private chat rooms with invite
* Show chat room default message expirations on-join
* Direct Messaging
* Text message / email notifications
* Basic smilies

## Features Yet To Be Implemented
* List of users in a room, plus online status
* Update page title when new messages and not focused. When focused, reset back
* Right-click menu popup instead of just delete
* Client side options for notification disable, sound effects etc.
* Sfx on-message
* Validation / error proofing
* Avatar generator
* Client-side addition of custom "emoticons/stickers"
* User token 'sharing' to other user-owned devices once signed in
* Moderation process (ie /kick for the creator)

## Other Features to Consider
* VOIP
* Inter-server communication system

### Known Bugs
* Leaving a room with /leave doesnt properly remove on server-side

### Special Thanks
Thanks goes to Sebastian Kraft for providing public domain smilies: http://opengameart.org/content/cubikopp-qubic-smilies
