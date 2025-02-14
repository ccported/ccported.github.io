const canvas = document.getElementById("can");
const scoreBin = document.getElementById("score");
const ctx = canvas.getContext("2d");
let scaleFactor = 1;
let mouseStart = [0, 0];
let isMouseDown = false;
let mouseEnd = [0, 0];
let ballSpawn = [0, 0];
let moveSpawn = [-100, -100];
let mousePos = [-100, -100];
let numBalls = 1;
let claimedBalls = 1;
let fallenBalls = 0;
let isRoundOver = true;
let isInter = false;
let squaresMoved = 0;
let toDrop = 55;
let ballSpeedMult = 1;
let runningTime = 0;
let balls = [];
let skippedRound = false;
const squares = [];
let ballCollectionSpheres = [];
let score = 1;
let isGameOver = false;
function draw() {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawSquares();
    drawBalls();
    drawPath();
    drawCollectionSpheres();
    drawSpawn();
    drawGameOverScreen();
    drawScore();
    drawDeathLine();
}

function drawGameOverScreen() {
    if (!isGameOver) return;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "30px Arial";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2);
    ctx.font = "20px Arial";
    ctx.fillText("Press Enter to play again", canvas.width / 2, canvas.height / 2 + 30);
    ctx.fillText("Score: " + score, canvas.width / 2, canvas.height / 2 + 60);
}
class GameObject {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.id = Math.random().toString(16).slice(2);
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}
class BallCollection extends GameObject {
    constructor(x, y, width, height) {
        super(x, y, width, height);
    }
    draw() {
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.width / 2, this.width / 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.width / 2, this.width / 3, 0, 2 * Math.PI);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();

    }
}
class Ball extends GameObject {
    constructor(x, y, width, height, color, speedX, speedY) {
        super(x, y, width, height, color);
        this.speedX = speedX;
        this.speedY = speedY;
    }
    hit() {
        this.speedX = Math.pow(this.speedX, 1.2);
        this.speedY = Math.pow(this.speedY, 1.2);
    }
    move({ stepCollisions, colliderGroups }) {
        let toMoveX = this.speedX * ballSpeedMult;
        let toMoveY = this.speedY * ballSpeedMult;
        let x = this.x;
        let y = this.y;

        if (stepCollisions) {
            // Increase number of steps based on velocity magnitude
            const velocity = Math.sqrt(toMoveX * toMoveX + toMoveY * toMoveY);
            let numSteps = Math.max(10, Math.ceil(velocity / 5)) * ballSpeedMult;
            let stepX = toMoveX / numSteps;
            let stepY = toMoveY / numSteps;
            let collision = false;
            for (let i = 0; i < numSteps; i++) {
                x += stepX;
                y += stepY;

                // Calculate circle center from top-left position
                const radius = this.width / 2;
                const centerX = x + radius;
                const centerY = y + radius;
                for (let j = 0; j < colliderGroups.length; j++) {
                    let group = colliderGroups[j];
                    if (collision) break;
                    for (let k = 0; k < group.length; k++) {
                        let object = group[k];

                        if (object instanceof Square) {
                            // Find closest point on rectangle to circle center
                            const closestX = Math.max(object.x, Math.min(centerX, object.x + object.width));
                            const closestY = Math.max(object.y, Math.min(centerY, object.y + object.height));

                            // Calculate distance between closest point and circle center
                            const distanceX = centerX - closestX;
                            const distanceY = centerY - closestY;
                            const distanceSquared = distanceX * distanceX + distanceY * distanceY;

                            if (distanceSquared < radius * radius) {
                                // Collision detected
                                const distance = Math.sqrt(distanceSquared);
                                if (distance > 0) {
                                    // Calculate normal vector
                                    const normalX = distanceX / distance;
                                    const normalY = distanceY / distance;

                                    // Calculate reflection vector
                                    const dotProduct = this.speedX * normalX + this.speedY * normalY;
                                    this.speedX = this.speedX - 2 * dotProduct * normalX;
                                    this.speedY = this.speedY - 2 * dotProduct * normalY;

                                    // Move circle out of collision
                                    // Note: we subtract radius to convert back to top-left position
                                    x = closestX + normalX * radius - radius - stepX;
                                    y = closestY + normalY * radius - radius - stepY;
                                    object.hit();
                                    if (object.amountLeft === 0) {
                                        squares.splice(k, 1);
                                    }
                                    collision = true;
                                    break;
                                }
                            }
                        } else if (object instanceof BallCollection) {
                            // For ball collections, center-to-center distance
                            const otherRadius = object.width / 2;
                            const otherCenterX = object.x + otherRadius;
                            const otherCenterY = object.y + otherRadius;

                            const dx = centerX - otherCenterX;
                            const dy = centerY - otherCenterY;
                            const distance = Math.sqrt(dx * dx + dy * dy);

                            if (distance < radius + otherRadius) {
                                claimedBalls++;
                                ballCollectionSpheres.splice(k, 1);
                                collision = true;
                                break;
                            }
                        }
                    }
                }
                if (collision) break;
            }
        }

        this.x = x;
        this.y = y;

        // Add some damping to prevent infinite bouncing
        this.speedX *= 0.999;
        this.speedY *= 0.999;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.width / 2, this.width / 2, 0, 2 * Math.PI);
        ctx.fill();
    }
}
class Square extends GameObject {
    constructor(x, y, width, height, amountLeft) {
        super(x, y, width, height, "white");
        this.amountLeft = amountLeft;
    }
    draw() {
        ctx.fillStyle = colorBand(this.amountLeft);
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = "black";
        ctx.font = "15px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.amountLeft, this.x + this.width / 2, this.y + this.height / 2);
    }
    hit() {
        this.amountLeft--;
    }
}



function drawBalls() {
    balls.forEach(ball => {
        ball.draw();
    });
}

function drawSquares() {
    squares.forEach(square => {
        square.draw();
    });
}
function drawDeathLine() {
    ctx.strokeStyle = "red";
    // dashed
    ctx.setLineDash([5, 15]);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 55);
    ctx.lineTo(canvas.width, canvas.height - 55);
    ctx.stroke();
    ctx.setLineDash([]);
}
function drawScore() {
    // let text = "Score: " + score;
    // ctx.fillStyle = "white";
    // ctx.font = "35px Arial";
    // ctx.textAlign = "center";
    // ctx.fillText(text, canvas.width/2, 30);
    // ctx.strokeStyle = "black";
    // ctx.strokeText(text, canvas.width/2, 30);
    scoreBin.innerHTML = score;

}
function drawMouse() {
    // cross hair
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mousePos[0], mousePos[1] - 10);
    ctx.lineTo(mousePos[0], mousePos[1] + 10);
    ctx.moveTo(mousePos[0] - 10, mousePos[1]);
    ctx.lineTo(mousePos[0] + 10, mousePos[1]);
    ctx.stroke();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mousePos[0], mousePos[1] - 10);
    ctx.lineTo(mousePos[0], mousePos[1] + 10);
    ctx.moveTo(mousePos[0] - 10, mousePos[1]);
    ctx.lineTo(mousePos[0] + 10, mousePos[1]);
    ctx.stroke();

}
function drawPath() {
    if (!isMouseDown) return;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 10;
    let lastLine = [ballSpawn[0] + 10, ballSpawn[1] + 10];
    const dx = ((mouseEnd[0] + 10) - lastLine[0]) / 300;
    const dy = ((mouseEnd[1] + 10) - lastLine[1]) / 300;
    for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(lastLine[0], lastLine[1]);
        const x = lastLine[0] + (dx * 2);
        const y = lastLine[1] + (dy * 2);
        lastLine = [x + (dx * 20), y + (dy * 20)];
        ctx.lineTo(x, y);
        ctx.stroke();
    }
}
function drawCollectionSpheres() {
    ballCollectionSpheres.forEach(sphere => {
        sphere.draw();
    });
}
function drawSpawn() {
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(ballSpawn[0] + 10, ballSpawn[1] + 10, 10, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.font = "15px Arial";
    ctx.fillText("x" + numBalls, ballSpawn[0] + 35, ballSpawn[1] + 10);

    ctx.beginPath();
    ctx.arc(moveSpawn[0] + 10, moveSpawn[1] + 10, 10, 0, 2 * Math.PI);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
}
function update() {
    balls.forEach(ball => {
        ball.move({
            stepCollisions: true,
            colliderGroups: [squares, ballCollectionSpheres],
        });
        if (ball.x < 0 || ball.x + ball.width > canvas.width) {
            if (ball.x < 0) {
                ball.x = 0;
            } else {
                ball.x = canvas.width - ball.width;
            }
            ball.speedX = -ball.speedX;
        }
        if (ball.y < 0) {
            ball.speedY = -ball.speedY;
            ball.y = 0;
        }
        if (ball.y + ball.width > canvas.height) {
            if (fallenBalls == 0) {
                moveSpawn = [ball.x, canvas.height - 30];
            }
            fallenBalls++;
            balls.splice(balls.indexOf(ball), 1);
            if (balls.length == 0) {
                endRound();
            }
        }
    });
}
function endRound() {
    isRoundOver = true;
    isInter = true;
    fallenBalls = 0;
    squaresMoved = 0;
    numBalls = claimedBalls;
    runningTime = performance.now();
    ballSpawn = [...moveSpawn];
    score++;
}
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw();
    drawMouse();
    if (isGameOver) {
        return requestAnimationFrame(gameLoop);
    }
    if (!isInter) {
        ballSpeedMult = Math.max(1, Math.floor((performance.now() - runningTime) / 5000));
        update();
    } else {
        squares.forEach(square => {
            square.y += 1;
            if (square.y + square.height > canvas.height - square.height) {
                gameOver();
            }
        });
        ballCollectionSpheres.forEach(sphere => {
            sphere.y += 1;
        });
        squaresMoved++;
        if (squaresMoved == toDrop) {
            isInter = false;
            skippedRound = false;
            initRow();
        }
    }
    requestAnimationFrame(gameLoop);
}
function initRow() {
    const numSlots = 8;
    const realWidth = 55;
    const realHeight = 55;
    for (let i = 0; i < numSlots; i++) {
        let odds = Math.random();
        if (odds < (0.45)) {
            let num = Math.floor(randRange(Math.pow(score, 1), Math.pow(score, 1.2)));
            squares.push(new Square((i * realWidth), 0, realWidth, realHeight, num));
        } else {
            let ballSphereOdds = Math.random();
            if (ballSphereOdds > 0.6) {
                ballCollectionSpheres.push(new BallCollection((i * realWidth), 0, realWidth, realHeight));
            }
        }
    }
}
let ftime = false;
function gameOver() {
    if (ftime) return;
    ftime = true;
    if (window.ccPorted.user) {
        window.ccPorted.leaderboard.addScore(window.ccPorted.user.id, score);
    } else {
        window.ccPorted.leaderboard.addGuestScore(score);
    }
    isGameOver = true;
}
window.addEventListener("load", (e) => {
    window.ccPorted.leaderboard = new Leaderboard('ballz', window.ccSupaClient);

    const desiredWidth = 440;
    const desiredHeight = 605;

    canvas.width = desiredWidth;
    canvas.height = desiredHeight;

    ballSpawn = [(canvas.width / 2), canvas.height - 30];
    initRow();
    gameLoop();

    window.ccPorted.leaderboard.loadScores(true).then(data => {
        const leaderboard = document.getElementById("leaderboard");
        data.forEach((entry, i) => {
            if (i == 10) {
                const ellipsisItem = document.createElement("li");
                ellipsisItem.textContent = "...";
                leaderboard.appendChild(ellipsisItem);
                return;
            }

            const listItem = document.createElement("li");
            if (entry.id == "guest" || entry.id == window.ccPorted.user?.id) {
                listItem.style.color = "#FFD700";
            } else {
                listItem.style.color = "#ffffff";
            }
            const displayName = entry.display_name.length > 20 ? entry.display_name.substring(0, 19) + "..." : entry.display_name;
            const score = entry.score;
            const userSpan = document.createElement("span");
            userSpan.textContent = (entry.rank + 1) + ". " + displayName + "";
            const scoreSpan = document.createElement("span");
            scoreSpan.textContent = score;
            listItem.style.display = "flex";
            listItem.style.justifyContent = "space-between";

            listItem.appendChild(userSpan);
            listItem.appendChild(scoreSpan);
            leaderboard.appendChild(listItem);
            leaderboard.style.paddingInlineStart = "0px";
        })
    })
});


document.addEventListener("keydown", (e) => {
    if (e.which == 13) {
        if (isGameOver) {
            location.reload();
            return;
        }
        if (skippedRound) { return; }
        balls = [];
        if (moveSpawn[0] == -100) {
            moveSpawn = [ballSpawn[0], canvas.height - 30];
        }
        skippedRound = true;
        endRound();
    }
})
canvas.addEventListener("mousedown", (e) => {
    if (!isRoundOver) return;
    if (isGameOver) return;
    isMouseDown = true;
    mouseStart = [(e.clientX - canvas.offsetLeft - 10), (e.clientY - canvas.offsetTop - 10)];
    mouseEnd = [(e.clientX - canvas.offsetLeft - 10), (e.clientY - canvas.offsetTop - 10)];
});
document.addEventListener("mousemove", (e) => {
    if (isMouseDown) {
        mouseEnd = [e.clientX - canvas.offsetLeft - 10, e.clientY - canvas.offsetTop - 10];
    }
    mousePos = [e.clientX - canvas.offsetLeft, e.clientY - canvas.offsetTop];
});
document.addEventListener("mouseup", (e) => {
    if (isGameOver) {
        return;
    }
    if (!isRoundOver) return;
    isRoundOver = false;
    isMouseDown = false;
    mouseEnd = [(e.clientX - canvas.offsetLeft - 10), (e.clientY - canvas.offsetTop - 10)];
    let speedX = (mouseEnd[0] - ballSpawn[0]) / 20;
    let speedY = (mouseEnd[1] - ballSpawn[1]) / 20;
    const totalSpeed = Math.sqrt(Math.pow(speedX, 2) + Math.pow(speedY, 2));
    const maxSpeed = 10;
    if (totalSpeed > maxSpeed) {
        speedX = (speedX / totalSpeed) * maxSpeed;
        speedY = (speedY / totalSpeed) * maxSpeed;
    }
    function spawn() {
        if(skippedRound) return;
        numBalls--;
        balls.push(new Ball(ballSpawn[0], ballSpawn[1], 20, 20, "white", speedX, speedY));
        if (numBalls > 0 && !skippedRound) {
            setTimeout(spawn, 100 / ballSpeedMult);
        }
    }
    runningTime = performance.now();
    spawn();
});


function randRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function colorBand(amountLeft) {
    const bands = [
        "red",
        "orange",
        "yellow",
        "green",
        "blue",
        "purple",
        "white"
    ];
    const bandSize = 10;
    return bands[Math.min(Math.floor(amountLeft / bandSize), bands.length - 1)];
}