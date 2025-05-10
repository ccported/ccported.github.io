class Leaderboard {
    constructor(gameID) {
        if (!gameID) {
            throw new Error("Game ID is required");
        }
        this.gameID = gameID;
        this.cached = [];
        this.loading = false;
        this.needsRefresh = false;
        this.score = 0;
    }
    async loadScores() {
        if (!window.ccPorted.user) {
            await window.ccPorted.userPromise;
        }
        if (this.loading && this.cached.length > 0) {
            return this.cached;
        }
        if (this.cached.length > 0 && !this.needsRefresh) {
            return this.cached;
        }
        this.loading = true;
        try {
            const data = await window.ccPorted.query({
                TableName: "leaderboard",
                IndexName: "gameID-score-index",
                Limit: 10,
                ScanIndexForward: false,
                KeyConditionExpression: "gameID = :gameID AND score > :score",
                ExpressionAttributeValues: {
                    ":gameID": this.gameID,
                    ":score": 0
                }
            });
            this.loading = false;
            var rp = false;
            var scores = data.Items.map((row, i) => {
                if (row.userID == 'guest' || row.userID == window.ccPorted?.user?.sub) {
                    rp = true;
                }
                return {
                    score: row.score,
                    id: row.userID,
                    display_name: row.displayName,
                    rank: i + 1
                }

            });
            if (this.guestScore != undefined) {
                scores.push({ score: this.guestScore, display_name: 'Guest', userID: 'guest' });
                scores.sort((a, b) => b.score - a.score);
            }
            this.cached = scores;
            this.needsRefresh = false;
            return scores;
        } catch (e) {
            console.log("[LEADERBOARD] Error getting scores", e);
        }
    }
    addGuestScore(score) {
        this.guestScore = score;
        if (this.cached.length > 0) {
            this.cached.push({ score: score, display_name: 'Guest', userID: 'guest' });
            this.cached.sort((a, b) => b.score - a.score);
        }
    }
    formatScore(score) {
        // 1000 -> 1K
        // 1000000 -> 1M
        // 1234567 -> 1.23M
        // thousand, million, billion, trillion, quadrilion, quintillion, sextillion, septillion, octillion, nonillion, decillion, undecillion, duodecillion
        if (score < 1000) {
            return score;
        } else if (score < 1_000_000) {
            return (score / 1000).toFixed(2) + 'K';
        } else if (score < 1000000000) {
            return (score / 1_000_000).toFixed(2) + 'M';
        } else if (score < 1_000_000_000_000) {
            return (score / 1_000_000_000).toFixed(2) + 'B';
        } else if (score < 1_000_000_000_000_000) {
            return (score / 1_000_000_000_000).toFixed(2) + 'T';
        } else if (score < 1_000_000_000_000_000_000) {
            return (score / 1_000_000_000_000_000).toFixed(2) + 'Q';
        } else if (score < 1_000_000_000_000_000_000_000) {
            return (score / 1_000_000_000_000_000_000).toFixed(2) + 'QQ';
        } else if (score < 1_000_000_000_000_000_000_000_000) {
            return (score / 1_000_000_000_000_000_000_000).toFixed(2) + 'S';
        } else if (score < 1_000_000_000_000_000_000_000_000_000) {
            return (score / 1_000_000_000_000_000_000_000_000).toFixed(2) + 'SS';
        } else if (score < 1_000_000_000_000_000_000_000_000_000_000) {
            return (score / 1_000_000_000_000_000_000_000_000_000).toFixed(2) + 'O';
        } else if (score < 1_000_000_000_000_000_000_000_000_000_000_000) {
            return (score / 1_000_000_000_000_000_000_000_000_000_000).toFixed(2) + 'N';
        } else if (score / 1_000_000_000_000_000_000_000_000_000_000_000) {
            return (score / 1_000_000_000_000_000_000_000_000_000_000_000).toFixed(2) + 'D';
        } else {
            return score.toExponential(2);
        }
    }
    async addScore(score) {
        log("adding score");
        if(!window.ccPorted.user) {
            return this.addGuestScore(score);
        }
        try {
            // find old score
            const data = await window.ccPorted.query({
                TableName: "leaderboard",
                KeyConditionExpression: "gameID = :gameID AND userID = :userID",
                ExpressionAttributeValues: {
                    ":gameID": this.gameID,
                    ":userID": window.ccPorted.user.sub
                },
                Limit: 1
            });
            const oldScore = data.Items;
            // update score if new score is higher
            if (oldScore && oldScore.length > 0) {
                if (oldScore[0].score >= score) {
                    log("Old score is higher");
                    this.score = { score: score, userID: window.ccPorted.user.sub, displayName: window.ccPorted.user.attributes["preferred_username"] || window.ccPorted.user["cognito:username"] || "Anonymous" };
                    return;
                }
            }
            const newData = { gameID: this.gameID, userID: window.ccPorted.user.sub, score: score, displayName: window.ccPorted.user.attributes["preferred_username"] || window.ccPorted.user["cognito:username"] || "Anonymous" };
            const params = {
                TableName: 'leaderboard',
                Key: {
                    gameID: this.gameID,
                    userID: window.ccPorted.user.sub
                },
                UpdateExpression: 'set score = :s, displayName = :d',
                ExpressionAttributeValues: {
                    ':s': score,
                    ':d': newData.displayName
                }
            }
            await window.ccPorted.documentClient.update(params).promise();
            log("Score updated");
            this.needsRefresh = true;
        } catch (e) {
            console.error(e);
            log(e);
        }
    }
    clearCache() {
        this.cached = [];
    }
}
