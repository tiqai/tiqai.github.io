export default class Controller {
    constructor(game, view)  {
        this.game = game;
        this.view = view;
        this.isPlaying = false;   

        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.startTimer();
        this.view.renderStartScreen();
    }

    startTimer() {
        const speed = 1000 - this.game.getState().level * 100;

        setInterval(() => {
            this.update();
        }, speed > 0 ? speed : 100);
    }  

    update() {
        const state = this.game.getState();

        if (state.isGameOver) {
            this.view.renderGameOverScreen(state);
            this.isPlaying = false;
        } else if (this.isPlaying) {
            this.game.movePieceDown();
            this.view.renderMainScreen(state);
        }
    }

    pause() {
        this.view.renderPauseScreen();
    }

    handleKeyDown(event) {        
        if (this.game.getState().isGameOver)
            return;

        switch (event.keyCode) {
            case 13:
                this.isPlaying = !this.isPlaying;

                if (this.isPlaying) {
                    this.view.renderMainScreen(this.game.getState());
                } else {
                    this.pause();
                }
                return;
        }

        if (this.isPlaying)
            switch (event.keyCode) {
                case 37:
                    this.game.movePieceLeft();
                    this.view.renderMainScreen(this.game.getState());
                    break;

                case 38:
                    this.game.rotatePiece();
                    this.view.renderMainScreen(this.game.getState());
                    break;

                case 39:
                    this.game.movePieceRight();
                    this.view.renderMainScreen(this.game.getState());
                    break;

                case 40:
                    this.game.movePieceDown();
                    this.view.renderMainScreen(this.game.getState());
                    break;
            }
    }
}