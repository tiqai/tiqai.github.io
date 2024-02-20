const CHARACTERS =
	'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトホモヨョロヲゴゾドボポヴッン'

const CHARACTERS2 = 'ЯНЕГЕЙ'

export class Column {
	constructor(x, fontSize, canvasHeight, context) {
		this.x = x
		this.y = 16
		this.fontSize = fontSize
		this.canvasHeight = canvasHeight
		this.context = context
		this.i = 0
	}

	drawSymbol() {
		if (this.y === 16 && Math.random() < 0.98) {
			return
		}

		const characterIndex = Math.floor(Math.random() * CHARACTERS.length)
		const symbol = CHARACTERS[characterIndex]

		// if (this.i >= CHARACTERS2.length) this.i = 0

		// const symbol = CHARACTERS2[this.i++]

		this.context.fillText(symbol, this.x, this.y)

		if (this.y > this.canvasHeight) {
			this.y = 0
		} else {
			this.y += this.fontSize
		}
	}
}
