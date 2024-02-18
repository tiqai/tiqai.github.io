import { Point } from './point.js'

const COLORS = ['#fffd69', '#56df7f', '#567fe0', '#ff5a60']

export class Cell {
	constructor(gameBoard, x, y) {
		this.x = x
		this.y = y
		this.gameBoard = gameBoard
		this.isLinked = false

		this.element = document.createElement('div')
		this.element.classList.add('cell')

		this.color = this.getRandomColor()

		gameBoard.append(this.element)
		this.point = new Point(gameBoard, this, this.color, x, y)
	}

	getRandomColor() {
		let randomIndex = Math.floor(Math.random() * COLORS.length)
		return COLORS[randomIndex]
	}

	clearPoint() {
		this.isLinked = false
		this.color = null
		this.point?.pointElement.remove()
		this.point = null
	}

	isNear(x, y) {
		let xIsNear = this.x === x - 1 || this.x === x + 1 || this.x === x
		let yIsNear = this.y === y - 1 || this.y === y + 1 || this.y === y
		return xIsNear && yIsNear
	}

	setNewPoint(cell) {
		if (cell.isEmpty()) return

		this.color = cell.color
		this.point = cell.point
		cell.point = null
		this.point.setNewCell(this)
		cell.clearPoint()
	}

	createPoint() {
		this.color = this.getRandomColor()
		this.point = new Point(this.gameBoard, this, this.color, this.x, this.y)
	}

	isEmpty() {
		return this.point === null
	}
}
