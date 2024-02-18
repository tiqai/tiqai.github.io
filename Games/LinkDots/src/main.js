import { Grid, cells } from './grid.js'

const gameBoard = document.getElementById('game-board')
const scoreElement = document.getElementById('score').children[0]
const lineElements = []
const grid = new Grid(gameBoard)
let score = 0

for (const cell of cells) {
	cell.element.addEventListener('mousedown', () => clickOnPoint(cell))
	cell.element.addEventListener('mouseover', () => overPoint(cell))
}

let currentCell = null
let isMouseDown = false
addEventListener('mouseup', () => mouseUp())

function clickOnPoint(newCell) {
	currentCell = newCell
	isMouseDown = true
}

function overPoint(newCell) {
	if (isMouseDown) {
		if (currentCell.color === newCell.color && !newCell.isLinked) {
			if (newCell.isNear(currentCell.x, currentCell.y)) {
				currentCell.isLinked = true
				newCell.isLinked = true
				drawLine(currentCell.element, newCell.element)
				currentCell = newCell
			}
		}
	}
}

function mouseUp() {
	for (let i = 0; i < lineElements.length; i++) {
		lineElements[i].remove()
	}

	const linkedPointsCount = grid.checkLinkedCells()
	score += linkedPointsCount * 10
	counter(score)

	currentCell = null
	isMouseDown = false
}

function drawLine(firstCell, secondCell) {
	const point1 = firstCell.getBoundingClientRect()
	const point2 = secondCell.getBoundingClientRect()

	let firstCenterX = point1.x + point1.width / 2
	let firstCenterY = point1.y + point1.height / 2
	let secondCenterX = point2.x + point2.width / 2
	let secondCenterY = point2.y + point2.height / 2

	if (secondCenterX < firstCenterX) {
		let tmp = secondCenterX
		secondCenterX = firstCenterX
		firstCenterX = tmp

		tmp = secondCenterY
		secondCenterY = firstCenterY
		firstCenterY = tmp
	}

	let lineLength = Math.sqrt(
		Math.pow(secondCenterX - firstCenterX, 2) + Math.pow(secondCenterY - firstCenterY, 2)
	)
	let m = (secondCenterY - firstCenterY) / (secondCenterX - firstCenterX)
	let degree = (Math.atan(m) * 180) / Math.PI

	let inaccuracyX = 0
	let inaccuracyY = 0
	const height = 10

	if (degree > 0) {
		if (degree === 45) {
			inaccuracyX = height / 2
		} else {
			inaccuracyX = inaccuracyY = height / 2
		}
	} else if (degree < 0) {
		inaccuracyX = -(height / 2)
	} else {
		inaccuracyX = inaccuracyY = -(height / 2)
	}

	const line = document.createElement('div')
	line.classList.add('line')
	line.style = `
		transform-origin: top left; 
    transform: rotate(${degree}deg); 
    width:${lineLength}px; 
    height: ${height}px;
    background-color: ${currentCell.color}; 
    top: ${firstCenterY + inaccuracyY}px; 
    left: ${firstCenterX + inaccuracyX}px;>
    </div>`

	lineElements.push(line)
	gameBoard.append(line)
}

function counter(target) {
	const timeToEnd = 200 //ms
	const time = 10
	const step = Math.ceil(target / timeToEnd)

	let currentNumber = Number(scoreElement.textContent)

	const interval = setInterval(() => {
		currentNumber += step

		if (currentNumber >= target) {
			scoreElement.textContent = target
			clearInterval(interval)
		} else {
			scoreElement.textContent = currentNumber
		}
	}, time)
}
