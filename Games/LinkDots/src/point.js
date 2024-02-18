export class Point {
	constructor(gameboard, cell, color, x, y) {
		this.cell = cell
		this.cellElement = cell.element

		this.pointElement = document.createElement('div')
		this.pointElement.classList.add('point')
		this.pointElement.style.backgroundColor = color
		gameboard.append(this.pointElement)
		this.setXY(x, y)
	}

	setXY(x, y) {
		this.x = x
		this.y = y
		this.pointElement.style.setProperty('--y', this.y)
		this.pointElement.style.setProperty('--x', this.x)
	}

	setNewCell(cell) {
		this.cell = cell
		this.cellElement = cell.element
		this.setXY(cell.x, cell.y)
	}
}
