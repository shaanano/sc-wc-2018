'use strict';
var http = require('http');

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 1337,
    ip = process.env.IP || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0'

// var options = {
//     host: "192.168.0.200",
//     port: 8080,
// };

var request = require("request")
const bets = require("./bets.json")
const bets_ko = require("./bets_ko.json")

const game_order = [[0, 8, 12, 15], [1], [4, 9], [5], [2, 11, 13], [3], [6, 10], [7]]

var groups = {}
var players = []
var playersWithPosition = []
var players_ko = []
var stages =
    {
        "Final": {},
        "Semi-finals": {},
        "Quarter-finals": {},
        "Round of 16": {}
    }
var knockout = []

console.log("(%s) Starting server", new Date())
var server = http.createServer(function (req, res) {
    if (req.url === "/favicon.ico")
        return

    var clientAddress = req.socket.remoteAddress + ':' + req.socket.remotePort

    console.log("(%s) New request from %s. URL: %s", new Date(), clientAddress, req.url)

    if (req.url.includes("/bets")) {
        if (req.url === "/bets/json") {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(bets))
        }
        else if (req.url === "/bets_g/json") {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(bets))
        }
        else if (req.url === "/bets_g") {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            var table = '<html><head><title>SC WC 2018 Player Bets</title></head><body><table border="1" align="center"><tr><th>Name</th><th>Group</th><th>1st</th><th>2nd</th><th>Last</th></tr>'
            for (var i = 0; i < bets.length; i++) {
                var player = bets[i]
                for (var j = 0; j < player.groups.length; j++) {
                    table += '<tr align="center">'
                    if (j == 0)
                        table += '<td rowspan="8" valign="middle">' + player.name + '</td>'

                    var group = player.groups[j]
                    table += '<td>' + group.letter + '</td>'

                    for (var k = 0; k <= 2; k++) {
                        table += '<td>' + group.teams[k] + '</td>'
                    }

                    table += '</tr>'
                }
            }
            table += '</table></body></html>'
            res.end(table)
        }
        else {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            var table = '<html><head><title>SC WC 2018 Knockout Bets</title></head><body><table border="1" align="center"><tr><th>Name</th><th>1/4</th><th>1/2</th><th>Final</th><th>Winner</th></tr>'
            for (var i = 0; i < bets_ko.length; i++) {
                var player = bets_ko[i]
                for (var j = 0; j < 8; j++) {
                    table += '<tr align="center">'
                    if (j == 0)
                        table += '<td rowspan="8" valign="middle">' + player.name + '</td>'

                    var game_row = game_order[j];


                    table += '<td>' + player.bets[game_row[0]] + '</td>'
                    if (j % 2 == 0)
                        table += '<td rowspan="2">' + player.bets[game_row[1]] + '</td>'
                    if (j % 4 == 0)
                        table += '<td rowspan="4">' + player.bets[game_row[2]] + '</td>'

                    if (j == 0)
                        table += '<td rowspan="8" valign="middle">' + player.bets[15] + '</td>'

                    table += '</tr>'
                }
            }
            table += '</table></body></html>'
            res.end(table)
        }

        return
    }
    else if (req.url.includes("/groups")) {
        getGroups(function () {
            doCalcGroups()
            if (req.url === "/json") {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                var resObject = { "pointsOnly": players, "withPosition": playersWithPosition }
                res.end(JSON.stringify(resObject))
            }
            else {
                res.writeHead(200, { 'Content-Type': 'text/html' })
                var table = ''

                var playerTable = (req.url.includes("with_pos")) ? playersWithPosition : players
                table += '<html><head><title>SC WC 2018 Group Standings</title></head><body><table border="1" align="center"><tr><th>Rank</th><th>Name</th><th>Team Points</th><th>Position Points</th><th>Total Points</th></tr>'
                for (var i = 0; i < playerTable.length; i++) {
                    var player = playerTable[i]
                    table += '<tr align="center"><td>' + (i + 1) + '</td><td align="left">' + player.name + '</td><td>' + player.points + '</td><td>' + player.positionPoints + '</td><td>' + player.totalPoints + '</td></tr>'
                }
                table += '</table></body></html>'
                res.end(table)
            }
        })
    }
    else {
        getMatches(function () {
            doCalcKO()
            if (req.url === "/json") {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify(players_ko))
            }
            else {
                res.writeHead(200, { 'Content-Type': 'text/html' })
                var table = ''

                table += '<html><head><title>SC WC 2018 Standings</title></head><body><table border="1" align="center" valign="middle"><tr><th>Rank</th><th>Name</th><th>1/4</th><th>1/2</th><th>Final</th><th>Winner</th><th>Group Stage</th><th>Knockout Stage</th><th>Total Points</th></tr>'
                for (var i = 0; i < players_ko.length; i++) {
                    var player = players_ko[i]

                    for (var j = 0; j < 8; j++) {
                        table += '<tr align="center">'
                        if (j == 0)
                            table += '<td rowspan="8" >' + (i + 1) + '</td><td rowspan="8">' + player.name + '</td>'



                        var game_row = game_order[j];


                        table += '<td ' + getStyleByStatus(player.bets[game_row[0]].status) + '>' + player.bets[game_row[0]].team + '</td>'
                        if (j % 2 == 0)
                            table += '<td rowspan="2" ' + getStyleByStatus(player.bets[game_row[1]].status) + '>' + player.bets[game_row[1]].team + '</td>'
                        if (j % 4 == 0)
                            table += '<td rowspan="4" ' + getStyleByStatus(player.bets[game_row[2]].status) + '>' + player.bets[game_row[2]].team + '</td>'

                        if (j == 0) {
                            table += '<td rowspan="8" ' + getStyleByStatus(player.bets[14].status) + '>' + player.bets[14].team + '</td>'
                                + '<td rowspan="8">' + player.groupPoints + '</td>'
                                + '<td rowspan="8">' + player.koPoints + '</td>'
                                + '<td rowspan="8">' + player.totalPoints + '</td>'
                        }

                        table += '</tr>'
                    }


                }
                table += '</table></body></html>'
                res.end(table)
            }
        })
    }
})
    .on('listening', () => {
        console.log('(%s) Server listening on %j', new Date(), server.address())
    })
    .listen(port, ip)


function getGroups(callback) {
    console.log("(%s) Sending request", new Date())
    request({
        uri: "http://worldcup.sfg.io/teams/group_results",
        //proxy: "http://192.168.0.200:8080",
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            console.log("(%s) Received response", new Date())
            //console.log(body) // Print the json response
            groups = getGroupDictionary(body)
            if (undefined != callback)
                callback()
        }
    })
}

function getGroupDictionary(groupResults) {
    var groupDictionary = {}
    for (var i = 0; i < groupResults.length; i++) {
        var g = groupResults[i]
        var group = {}
        //console.log("Adding group %s", g.letter)
        var isFirst = true;
        for (var j = 0; j < g.ordered_teams.length; j++) {
            var team = g.ordered_teams[j]
            //console.log("Adding team %s", team.fifa_code)
            group[team.fifa_code] = { "points": team.points, "isFirst": isFirst }
            isFirst = false
        }
        groupDictionary[g.letter] = group
    }

    return groupDictionary
}

function getMatches(callback) {
    console.log("(%s) Sending request", new Date())
    request({
        uri: "http://worldcup.sfg.io/matches?by_date=asc",
        //proxy: "http://192.168.0.200:8080",
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            console.log("(%s) Received response", new Date())
            //console.log(body) // Print the json response
            knockout = getKnockout(body)
            if (undefined != callback)
                callback()
        }
    })
}

function getKnockout(matches) {
    var completedMatches = []

    for (var i = 48; i < matches.length; i++) {
        var match = matches[i]

        switch (match.status) {
            case "future":
                return completedMatches
            case "in progress":
                if (match.winner_code != null)
                    completedMatches.push(match)
                break
            case "completed":
                completedMatches.push(match)
                break
        }
    }

    return completedMatches
}

function doCalcGroups() {
    players = []
    for (var i = 0; i < bets.length; i++) {
        var player = bets[i]
        //console.log("Calculating for player %s", player.name)
        var points = 0
        var positionPoints = 0
        for (var j = 0; j < player.groups.length; j++) {
            var group = player.groups[j]
            //console.log("Calculating group %s", group.letter)
            var groupResult = groups[group.letter]

            for (var k = 0; k <= 2; k++) {
                var teamResult = groupResult[group.teams[k]]
                points += teamResult.points * ((k <= 1) ? 1 : -1)
                if (k == 0 && teamResult.isFirst)
                    positionPoints += 3
            }
        }

        var playerScore = { "name": player.name, "points": points, "positionPoints": positionPoints, "totalPoints": points + positionPoints }
        console.log("(%s) Player score: %j", new Date(), playerScore)
        players.push(playerScore)
    }
    playersWithPosition = players.slice()
    players.sort(comparePlayersInGroup)
    playersWithPosition.sort(comparePlayers)
}

function doCalcKO() {
    players_ko = []
    var eliminated_teams = {}
    for (var i = 0; i < bets_ko.length; i++) {
        var player = bets_ko[i]
        var playerBets = []
        //console.log("Calculating for player %s", player.name)
        var points = 0

        for (var j = 0; j < player.bets.length; j++) {
            var playerBet = player.bets[j]
            var betStatus = 0
            if (j < knockout.length) {
                if (knockout[j].winner_code == playerBet) {
                    points += 3
                    betStatus = 1
                }
                else {
                    eliminated_teams[playerBet] = true
                    betStatus = -1
                }
            }
            else if (eliminated_teams[playerBet]) {
                betStatus = -1
            }
            if (playerBet)
                playerBets.push({ "team": playerBet, "status": betStatus })
        }


        var playerScore = { "name": player.name, "groupPoints": player.group_score, "koPoints": points, "totalPoints": points + player.group_score, "bets": playerBets }
        console.log("(%s) Player score: %j", new Date(), playerScore)
        players_ko.push(playerScore)
    }
    players_ko.sort(comparePlayers)
}

function getStyleByStatus(status) {
    switch (status) {
        case -1:
            return 'style="text-decoration:line-through"'
        case 1:
            return 'style="font-weight:bold"'
        default:
            return ''
    }
}

function comparePlayersInGroup(a, b) {
    if (a.points > b.points)
        return -1;
    if (a.points < b.points)
        return 1;
    return 0;
}

function comparePlayers(a, b) {
    if (a.totalPoints > b.totalPoints)
        return -1;
    if (a.totalPoints < b.totalPoints)
        return 1;
    return 0;
}