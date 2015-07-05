Meteor.users.deny({
    update(){
        return true;
    }
});

Meteor.methods({
    updateTypingActivity(room) {
        check(room, String);
        var timestamp = new Date();
        Meteor.users.update({_id: Meteor.userId()}, {
            $set: {
                "status.lastTyping": timestamp,
                "status.lastActiveRoom": room
            }
        });
    },
    updateUsername(username) {
        check(username, String);
        var usernameRegex = new RegExp("$" + username + "^", "i");
        var user = Meteor.users.findOne({username: usernameRegex});
        if (user) {
            throw new Meteor.Error("username taken");
        }
        else if (!Schemas.regex.username.test(username)) {
            throw new Meteor.Error("username must be alphanumeric");
        }
        else {
            Meteor.users.update({_id: Meteor.userId()}, {$set: {'username': username}});
        }
    },
    updateProfile(profile) {
        check(profile, Schemas.userProfile);
        Meteor.users.update({_id: Meteor.userId()}, {$set: {'profile': profile}});
    },
    updateRoomOrder(roomOrderArr) {
        check(roomOrderArr, [String]);
        Meteor.users.update({_id: Meteor.userId()}, {$set: {"preferences.roomOrder": roomOrderArr}});
    },
    updateRoomPreferences(roomPreference) {
        if (!Match.test(roomPreference, Schemas.roomPreference)) {
            throw new Meteor.Error(roomPreference + " did not match schema.");
        }

        var preferenceUser = Meteor.user();
        var preferences = {};
        var roomPreferences = [];
        if (preferenceUser && preferenceUser.preferences) {
            preferences = preferenceUser.preferences;
            if (preferenceUser.preferences.room) {
                roomPreferences = preferenceUser.preferences.room;
            }
        }

        var i;
        for (i = 0; i < roomPreferences.length; i++) {
            if (roomPreferences[i].roomId === roomPreference.roomId) {
                roomPreferences[i] = roomPreference;
                break;
            }
        }
        // No current preference found
        if (i === roomPreferences.length) {
            roomPreferences.push(roomPreference);
        }

        preferences.room = roomPreferences;
        Meteor.users.update({_id: Meteor.userId()}, {$set: {"preferences": preferences}});
    },
    punchcard(userId) {
        check(userId, String);

        userId = userId || Meteor.userId();
        if (Meteor.isServer) {
            var milisecondsInWeek = 60 * 1000 * 60 * 24;
            var milisecondsIn5Minutes = 60 * 1000 * 5;
            var pipeline = [
                {$match: {authorId: userId, type: "plain"}},
                {
                    $project: {
                        "timestamp": {"$divide": [{"$mod": ["$timestamp", milisecondsInWeek]}, milisecondsIn5Minutes]},
                    }
                },
                {
                    $project: {
                        "timestamp": {"$subtract": ["$timestamp", {"$mod": ["$timestamp", 1]}]},
                    }
                },
                {$group: {"_id": "$timestamp", count: {$sum: 1}}}
            ];
            return Messages.aggregate(pipeline);
        }
    },
    roomPunchcard(options) {
        if (!options.roomId) {
            throw new Meteor.Error("Need room id");
        }
        var userId = options.userId || Meteor.userId();
        var roomId = options.roomId;
        if (Meteor.isServer) {
            var milisecondsInWeek = 60 * 1000 * 60 * 24;
            var milisecondsIn15Minutes = 60 * 1000 * 15;
            var pipeline = [
                {$match: {authorId: userId, type: "plain", roomId: roomId}},
                {
                    $project: {
                        "timestamp": {"$divide": [{"$mod": ["$timestamp", milisecondsInWeek]}, milisecondsIn15Minutes]},
                    }
                },
                {
                    $project: {
                        "timestamp": {"$subtract": ["$timestamp", {"$mod": ["$timestamp", 1]}]},
                    }
                },
                {$group: {"_id": "$timestamp", count: {$sum: 1}}}
            ];
            return Messages.aggregate(pipeline);
        }
    }
});