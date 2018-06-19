'use strict';
var http = require('http');

var server_port = process.env.OPENSHIFT_NODEJS_PORT || 1337
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1'

// var options = {
//     host: "192.168.0.200",
//     port: 8080,
// };

var request = require("request")
const bets = require("./bets.json")

var groups = {}
var players = []
var playersWithPosition = []

console.log("(%s) Starting server", new Date())
var server = http.createServer(function (req, res)
{
    if (req.url === "/favicon.ico")
        return

    var clientAddress = req.socket.remoteAddress + ':' + req.socket.remotePort

    console.log("(%s) New request from %s. URL: %s", new Date(), clientAddress, req.url)

    if (req.url.includes("/bets"))
    {
        if (req.url === "/bets/json")
        {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(bets))
        }
        else
        {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            var table = '<html><head><title>SC WC 2018 Player Bets</title></head><body><table border="1" align="center"><tr><th>Name</th><th>Group</th><th>1st</th><th>2nd</th><th>Last</th></tr>'
            for (var i = 0; i < bets.length; i++)
            {
                var player = bets[i]
                for (var j = 0; j < player.groups.length; j++)
                {
                    table += '<tr align="center">'
                    if (j == 0)
                        table += '<td rowspan="8" valign="middle">' + player.name + '</td>'

                    var group = player.groups[j]
                    table += '<td>' + group.letter + '</td>'

                    for (var k = 0; k <= 2; k++)
                    {
                        table += '<td>' + group.teams[k] + '</td>'
                    }

                    table += '</tr>'
                }
            }
            table += '</table></body></html>'
            res.end(table)
        }

        return
    }

    getGroups(function ()
    {
        doCalc()
        if (req.url === "/json")
        {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            var resObject = { "pointsOnly": players, "withPosition": playersWithPosition }
            res.end(JSON.stringify(resObject))
        }
        else
        {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            var table = ''

            var playerTable = (req.url.includes("with_pos")) ? playersWithPosition : players
            table += '<html><head><title>SC WC 2018 Standings</title></head><body><table border="1" align="center"><tr><th>Rank</th><th>Name</th><th>Team Points</th><th>Position Points</th><th>Total Points</th></tr>'
            for (var i = 0; i < playerTable.length; i++)
            {
                var player = playerTable[i]
                table += '<tr align="center"><td>' + (i + 1) + '</td><td align="left">' + player.name + '</td><td>' + player.points + '</td><td>' + player.positionPoints + '</td><td>' + player.totalPoints + '</td></tr>'
            }
            table += '</table></body></html>'
            res.end(table)
        }
    })
})
    .on('listening', () =>
    {
        console.log('(%s) Server listening on %j', new Date(), server.address())
    })
    .listen(server_port,server_ip_address)


function getGroups(callback)
{
    console.log("(%s) Sending request", new Date())
    request({
        uri: "http://worldcup.sfg.io/teams/group_results",
        //proxy: "http://192.168.0.200:8080",
        json: true
    }, function (error, response, body)
        {
            if (!error && response.statusCode === 200)
            {
                console.log("(%s) Received response", new Date())
                //console.log(body) // Print the json response
                groups = getGroupDictionary(body)
                if (undefined != callback)
                    callback()
            }
        })
}

function getGroupDictionary(groupResults)
{
    var groupDictionary = {}
    for (var i = 0; i < groupResults.length; i++)
    {
        var g = groupResults[i].group
        var group = {}
        //console.log("Adding group %s", g.letter)
        var isFirst = true;
        for (var j = 0; j < g.teams.length; j++)
        {
            var team = g.teams[j].team
            //console.log("Adding team %s", team.fifa_code)
            group[team.fifa_code] = { "points": team.points, "isFirst": isFirst }
            isFirst = false
        }
        groupDictionary[g.letter] = group
    }

    return groupDictionary
}

function doCalc()
{
    players = []
    for (var i = 0; i < bets.length; i++)
    {
        var player = bets[i]
        //console.log("Calculating for player %s", player.name)
        var points = 0
        var positionPoints = 0
        for (var j = 0; j < player.groups.length; j++)
        {
            var group = player.groups[j]
            //console.log("Calculating group %s", group.letter)
            var groupResult = groups[group.letter]

            for (var k = 0; k <= 2; k++)
            {
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
    players.sort(comparePlayers)
    playersWithPosition.sort(comparePlayersWithPosition)
}

function comparePlayers(a, b)
{
    if (a.points > b.points)
        return -1;
    if (a.points < b.points)
        return 1;
    return 0;
}

function comparePlayersWithPosition(a, b)
{
    if (a.totalPoints > b.totalPoints)
        return -1;
    if (a.totalPoints < b.totalPoints)
        return 1;
    return 0;
}