try {
    let font = false;
    const fontPS2P = new FontFace("ps2p", "url(ps2p.ttf)");
    fontPS2P.load().then(() => {
        font = true;
        document.fonts.add(fontPS2P)
    })
    const BLOCK_SIZE = 30;
    const ROWS = 20;
    const COLS = 10;
    const COLORS = [
        null,
        '#FF0D72', // I
        '#0DC2FF', // J
        '#0DFF72', // L
        '#F538FF', // O
        '#FF8E0D', // S
        '#FFE138', // T
        '#3877FF'  // Z
    ];

    const SHAPES = [
        [],
        [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
        [[2, 0, 0], [2, 2, 2], [0, 0, 0]], // J
        [[0, 0, 3], [3, 3, 3], [0, 0, 0]], // L
        [[4, 4], [4, 4]], // O
        [[0, 5, 5], [5, 5, 0], [0, 0, 0]], // S
        [[0, 6, 0], [6, 6, 6], [0, 0, 0]], // T
        [[7, 7, 0], [0, 7, 7], [0, 0, 0]]  // Z
    ];

    const canvas = document.getElementById('gameCanvas');
    const nextPieceCanvas = document.getElementById('nextPieceCanvas');
    const ctx = canvas.getContext('2d');
    const nextCtx = nextPieceCanvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const levelElement = document.getElementById('level');

    canvas.width = COLS * BLOCK_SIZE;
    canvas.height = ROWS * BLOCK_SIZE;
    nextPieceCanvas.width = 120;
    nextPieceCanvas.height = 120;

    // Sound effects using Howler.js
    const moveSound = new Howl({ src: ['sounds/move.mp3'] });
    const clearSound = new Howl({ src: ['sounds/line-clear.mp3'] });
    const dropSound = moveSound;
    const turnSound = moveSound;
    const music = new Howl({ src: ['sounds/bg.mp3'], loop: true });
    music.play();

    function formatScore(score) {
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
        } else if(score < 1_000_000_000_000_000_000_000_000_000_000_000_000){
            return (score / 1_000_000_000_000_000_000_000_000_000_000_000).toFixed(2) + 'D';
        } else {
            return score.toExponential(2);
        }
    }


    class Tetris {
        constructor() {
            this.reset();
        }

        reset() {
            this.board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
            this.score = 0;
            this.piece = null;
            this.nextPiece = this.createPiece();
            this.gameOver = false;
            this.dropCounter = 0;
            this.dropInterval = 1000;
            this.lastTime = 0;
            this.paused = 0;
            this.moving = [0,0];
            this.lastMove = 0;
            scoreElement.textContent = this.score;
            this.createNewPiece();
        }

        createPiece() {
            const num = 1 + Math.floor(Math.random() * 7);
            const piece = {
                pos: { x: 0, y: 0 },
                shape: SHAPES[num],
                color: num
            };
            piece.pos.x = Math.floor(COLS / 2) - Math.floor(piece.shape[0].length / 2);
            return piece;
        }

        createNewPiece() {
            this.piece = this.nextPiece;
            this.nextPiece = this.createPiece();
            if (this.collision()) {
                if(window.ccPorted.user){
                    window.ccPorted.leaderboard.addScore(window.ccPorted.user.id, game.score);
                }else{
                    window.ccPorted.leaderboard.addGuestScore(game.score);
                }
                this.gameOver = true;
            }
        }

        rotate(piece) {
            const rotated = piece.shape[0].map((_, i) =>
                piece.shape.map(row => row[i]).reverse()
            );
            const pos = piece.pos;
            let offset = 1;
            const originalShape = piece.shape;
            piece.shape = rotated;
            while (this.collision()) {
                piece.pos.x += offset;
                offset = -(offset + (offset > 0 ? 1 : -1));
                if (offset > piece.shape[0].length) {
                    piece.shape = originalShape;
                    piece.pos = pos;
                    return;
                }
            }
            turnSound.play();
        }

        collision() {
            for (let y = 0; y < this.piece.shape.length; y++) {
                for (let x = 0; x < this.piece.shape[y].length; x++) {
                    if (this.piece.shape[y][x] !== 0) {
                        const boardX = this.piece.pos.x + x;
                        const boardY = this.piece.pos.y + y;
                        if (boardX < 0 || boardX >= COLS ||
                            boardY >= ROWS ||
                            (boardY >= 0 && this.board[boardY][boardX])) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        merge() {
            this.piece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        const boardY = this.piece.pos.y + y;
                        if (boardY >= 0) {
                            this.board[boardY][this.piece.pos.x + x] = this.piece.color;
                        }
                    }
                });
            });
        }

        clearLines() {
            let linesCleared = 0;
            outer: for (let y = ROWS - 1; y >= 0; y--) {
                for (let x = 0; x < COLS; x++) {
                    if (this.board[y][x] === 0) {
                        continue outer;
                    }
                }
                const row = this.board.splice(y, 1)[0];
                this.board.unshift(row.fill(0));
                y++;
                linesCleared++;
            }
            if (linesCleared > 0) {
                clearSound.play();
                // Classic Tetris scoring
                this.score += [0, 40, 100, 300, 1200][linesCleared] * (Math.floor(this.score / 500) + 1);
                scoreElement.textContent = this.score;
                levelElement.textContent = this.calculateLevel() + 1;
            }
        }

        drop() {
            if(this.paused) {
                return;
            }
            this.piece.pos.y++;
            if (this.collision()) {
                this.piece.pos.y--;
                this.merge();
                dropSound.play();
                this.clearLines();
                this.createNewPiece();
            }
        }

        hardDrop() {
            if(this.paused){
                return;
            }
            while (!this.collision()) {
                this.piece.pos.y++;
            }
            this.piece.pos.y--;
            this.merge();
            dropSound.play();
            this.clearLines();
            this.createNewPiece();
        }

        move(dir) {
            if(this.paused){
                return;
            }
            this.piece.pos.x += dir;
            if (this.collision()) {
                this.piece.pos.x -= dir;
            } else {
                this.lastMove = 0;
                moveSound.play();
            }
        }

        getGhostPosition() {
            const ghost = {
                pos: { ...this.piece.pos },
                shape: this.piece.shape
            };
            while (!this.collision.call({ ...this, piece: ghost })) {
                ghost.pos.y++;
            }
            ghost.pos.y--;
            return ghost.pos;
        }
        updateGameOver() {
            if (this.gameOver) {
                this.draw();
                requestAnimationFrame(this.updateGameOver.bind(this));
            } else {
                requestAnimationFrame(this.update.bind(this));
            }
        }
        update(time = 0) {
            if(this.paused){
                this.draw();
                requestAnimationFrame(this.update.bind(this));
                return;
            }
            if (this.gameOver) {
                requestAnimationFrame(this.updateGameOver.bind(this));
            } else {
                const deltaTime = time - this.lastTime;
                this.lastTime = time;
                this.dropCounter += deltaTime;

                if (this.dropCounter > this.dropInterval) {
                    this.drop();
                    this.dropCounter = 0;
                }
                if(this.moving[0] != 0 || this.moving[1] != 0){
                    this.lastMove += deltaTime;
                    // if(this.lastMove > 200){
                    //     this.move(this.moving[0] + this.moving[1]);
                    //     this.lastMove = 0;
                    // }
                }
                this.dropInterval = Math.max(1000 - this.calculateLevel() * 100, 250);
                this.draw();
                requestAnimationFrame(this.update.bind(this));
            }
        }
        calculateLevel() {
            return Math.floor(this.score / 500);
        }
        draw() {
            // Clear canvas
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (this.gameOver) {
                // draw game over text;
                ctx.fillStyle = "#ffffff";
                ctx.textAlign = "center";
                ctx.font = "20px ps2p";
                ctx.fillText("GAME OVER!", canvas.width / 2, canvas.height / 2 - 100);
                ctx.font = "10px ps2p";
                ctx.fillText("Press enter to restart", canvas.width / 2, (canvas.height / 2) - 75);
                ctx.font = "13px ps2p";
                ctx.fillText("Leaderboard:", canvas.width / 2, (canvas.height / 2) - 40);
                window.ccPorted.leaderboard.loadScores(true).then((data) => {
                    ctx.font = "10px ps2p";
                    ctx.textAlign = "left";
                    data.forEach((entry, i) => {
                        if(i == 10){
                            ctx.fillText("...", canvas.width / 2 - 40, (canvas.height / 2) - 15 + (i * 15));
                        }
                        if(entry.id == "guest" || entry.id == window.ccPorted.user?.id){
                            ctx.fillStyle = "#FFD700";
                        }else{
                            ctx.fillStyle = "#ffffff";
                        }
           
                        const displayName = entry.display_name.length > 10 ? entry.display_name.substring(0, 9) + "..." : entry.display_name;
                        const score = formatScore(entry.score);
                        ctx.fillText(`${entry.rank || (i + 1)} ${displayName}: ${score}`, canvas.width / 2 - 110, (canvas.height / 2) - 15 + (i * 15) + (i == 10 ? 15 : 0));
                    });
                });
                return;
            }
            // Draw board
            this.board.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        ctx.fillStyle = COLORS[value];
                        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                        ctx.strokeStyle = '#111';
                        ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    }
                });
            });

            // Draw ghost piece
            const ghostPos = this.getGhostPosition();
            this.piece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                        ctx.fillRect(
                            (ghostPos.x + x) * BLOCK_SIZE,
                            (ghostPos.y + y) * BLOCK_SIZE,
                            BLOCK_SIZE, BLOCK_SIZE
                        );
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                        ctx.strokeRect(
                            (ghostPos.x + x) * BLOCK_SIZE,
                            (ghostPos.y + y) * BLOCK_SIZE,
                            BLOCK_SIZE, BLOCK_SIZE
                        );
                    }
                });
            });

            // Draw current piece
            this.piece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        ctx.fillStyle = COLORS[this.piece.color];
                        ctx.fillRect(
                            (this.piece.pos.x + x) * BLOCK_SIZE,
                            (this.piece.pos.y + y) * BLOCK_SIZE,
                            BLOCK_SIZE, BLOCK_SIZE
                        );
                        ctx.strokeStyle = '#111';
                        ctx.strokeRect(
                            (this.piece.pos.x + x) * BLOCK_SIZE,
                            (this.piece.pos.y + y) * BLOCK_SIZE,
                            BLOCK_SIZE, BLOCK_SIZE
                        );
                    }
                });
            });

            // Draw next piece preview
            nextCtx.fillStyle = '#333';
            nextCtx.fillRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);

            const blockSizeNext = 25;
            const offsetX = (nextPieceCanvas.width - this.nextPiece.shape[0].length * blockSizeNext) / 2;
            const offsetY = (nextPieceCanvas.height - this.nextPiece.shape.length * blockSizeNext) / 2;

            this.nextPiece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        nextCtx.fillStyle = COLORS[this.nextPiece.color];
                        nextCtx.fillRect(
                            offsetX + x * blockSizeNext,
                            offsetY + y * blockSizeNext,
                            blockSizeNext, blockSizeNext
                        );
                        nextCtx.strokeStyle = '#111';
                        nextCtx.strokeRect(
                            offsetX + x * blockSizeNext,
                            offsetY + y * blockSizeNext,
                            blockSizeNext, blockSizeNext
                        );
                    }
                });
            });
            if(this.paused){
                ctx.fillStyle = "#ffffff";
                ctx.textAlign = "center";
                ctx.font = "20px ps2p";
                ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
            }
        }
    }

    let game = new Tetris();
    document.addEventListener('keyup', event => {
        if (event.keyCode === 37 || event.keyCode === 39) {
            if(event.keyCode === 37){
                game.moving[0] = 0;
            }
            if(event.keyCode === 39){
                game.moving[1] = 0;
            }
        }
    });
    document.addEventListener('keydown', event => {

        switch (event.keyCode) {
            case 37: // Left arrow
                if (game.gameOver) break;
                if (game.paused) break;
                game.moving[0] = -1;
                game.move(-1);
                break;
            case 39: // Right arrow
                if (game.gameOver) break;
                if (game.paused) break;

                game.moving[1] = 1;
                game.move(1);
                break;
            case 40: // Down arrow
                if (game.gameOver) break;
                if (game.paused) break;

                game.drop();
                break;
            case 38: // Up arrow
                if (game.gameOver) break;
                if (game.paused) break;

                game.rotate(game.piece);
                break;
            case 32: // Space
                if (game.gameOver) break;
                if (game.paused) break;

                game.hardDrop();
                break;
            case 13: // enter
                if (game.gameOver) {
                    try {
                        game.reset();
                        // game = new Tetris();
                        game.update();
                        window.ccPorted.leaderboard.clearCache();
                    } catch (err) {
                        alert(err);
                    }
                }
                break;
            // p for pause
            case 80:
                game.paused = !game.paused;
                break;
        }
    });

    game.update();
    window.ccPorted.leaderboard = new Leaderboard('tetris', window.ccSupaClient);
} catch (err) {
    alert(err);
}