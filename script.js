// Данные приложения - только в памяти
let dishes = [];
let weekPlan = {};
let shoppingList = {};
let categories = ['Завтраки', 'Обеды', 'Ужины', 'Десерты', 'Салаты']; // Стандартные категории
let currentWeek = 1;
let currentMonth = 'Январь';
let currentYear = 2023;
let currentCategory = 'all';
let currentMealSlot = null;
let dishToDelete = null;

// Настройки синхронизации
let syncConfig = JSON.parse(localStorage.getItem('syncConfig')) || {};
let isSyncing = false;

// Единицы измерения для ингредиентов
const measurementUnits = [
    "г", "кг", "мл", "л", "шт", "ч.л.", "ст.л.", "щепотка", "по вкусу"
];

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    setupEventListeners();
    updateSyncUI();
    
    // Загружаем данные с сервера при запуске
    if (syncConfig.token && syncConfig.gistId) {
        loadFromGist();
    } else {
        // Показываем пустой интерфейс
        renderWeekPlanner();
        renderCategoryList();
        renderDishList();
        renderCategoriesManagement();
        updateCategorySelect();
        renderShoppingList();
        updateStatistics();
    }
});

// Инициализация навигации
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetSection = this.getAttribute('data-section');
            
            // Убираем активный класс у всех ссылок и секций
            navLinks.forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            
            // Добавляем активный класс к текущей ссылке и секции
            this.classList.add('active');
            document.getElementById(targetSection).classList.add('active');
            
            // При переходе на список покупок обновляем его
            if (targetSection === 'shopping-list') {
                renderShoppingList();
            }
            
            // При переходе на добавление блюда сбрасываем форму
            if (targetSection === 'add-dish') {
                resetDishForm();
            }
            
            // При переходе на категории обновляем список
            if (targetSection === 'categories') {
                renderCategoriesManagement();
            }
        });
    });
}

// ==================== СЕРВЕРНЫЕ ОПЕРАЦИИ ====================

// Загрузка данных с сервера
async function loadFromGist() {
    if (!syncConfig.token || !syncConfig.gistId || isSyncing) return;

    isSyncing = true;
    updateSyncStatus('pending', 'Загрузка данных...');

    try {
        const response = await fetch(`https://api.github.com/gists/${syncConfig.gistId}`, {
            headers: {
                'Authorization': `token ${syncConfig.token}`
            }
        });

        if (response.ok) {
            const gist = await response.json();
            const file = gist.files['meal-planner-data.json'];
            
            if (file && file.content) {
                const serverData = JSON.parse(file.content);
                
                // Полностью заменяем данные на серверные
                dishes = serverData.dishes || [];
                weekPlan = serverData.weekPlan || {};
                shoppingList = serverData.shoppingList || {};
                categories = serverData.categories || categories;
                currentWeek = serverData.currentWeek || currentWeek;
                currentMonth = serverData.currentMonth || currentMonth;
                currentYear = serverData.currentYear || currentYear;
                
                // Обновляем интерфейс
                renderWeekPlanner();
                renderCategoryList();
                renderDishList();
                renderCategoriesManagement();
                updateCategorySelect();
                renderShoppingList();
                updateStatistics();
                updateWeekTitle();
                
                updateSyncStatus('synced', 'Данные загружены');
                console.log('✅ Данные загружены с сервера');
            } else {
                // Файл не найден, создаем пустые данные
                await saveToGist();
            }
        } else {
            throw new Error('Ошибка загрузки: ' + response.status);
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        updateSyncStatus('error', 'Ошибка загрузки: ' + error.message);
        
        // Показываем пустой интерфейс при ошибке
        dishes = [];
        weekPlan = {};
        shoppingList = {};
        renderWeekPlanner();
        renderCategoryList();
        renderDishList();
        renderCategoriesManagement();
        updateCategorySelect();
        renderShoppingList();
        updateStatistics();
    } finally {
        isSyncing = false;
        updateSyncUI();
    }
}

// Сохранение данных на сервер
async function saveToGist() {
    if (!syncConfig.token || isSyncing) {
        console.log('❌ Не могу сохранить: нет токена или идет синхронизация');
        return;
    }

    isSyncing = true;
    updateSyncStatus('pending', 'Сохранение на сервер...');

    try {
        const data = {
            dishes,
            weekPlan,
            shoppingList,
            categories,
            currentWeek,
            currentMonth,
            currentYear,
            lastSync: new Date().toISOString(),
            version: '1.0'
        };

        const gistData = {
            files: {
                'meal-planner-data.json': {
                    content: JSON.stringify(data, null, 2)
                }
            },
            description: 'Meal Planner Data - ' + new Date().toLocaleDateString()
        };

        let response;
        
        if (syncConfig.gistId) {
            // Обновляем существующий Gist
            response = await fetch(`https://api.github.com/gists/${syncConfig.gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${syncConfig.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(gistData)
            });
        } else {
            // Создаем новый Gist
            response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${syncConfig.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(gistData)
            });
        }

        if (response.ok) {
            const result = await response.json();
            
            // Сохраняем ID Gist если он новый
            if (!syncConfig.gistId) {
                syncConfig.gistId = result.id;
                localStorage.setItem('syncConfig', JSON.stringify(syncConfig));
            }

            // Сохраняем время последней синхронизации
            syncConfig.lastSync = new Date().toISOString();
            localStorage.setItem('syncConfig', JSON.stringify(syncConfig));
            
            updateSyncStatus('synced', 'Данные сохранены');
            updateSyncUI();
            console.log('✅ Данные сохранены на сервер');
        } else {
            const errorText = await response.text();
            throw new Error(`Ошибка сохранения: ${response.status} - ${errorText}`);
        }
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        updateSyncStatus('error', 'Ошибка сохранения: ' + error.message);
        alert('Ошибка сохранения! Проверьте токен и подключение к интернету.');
    } finally {
        isSyncing = false;
    }
}

// Принудительная синхронизация
async function forceSync() {
    if (!syncConfig.token) {
        alert('Сначала настройте синхронизацию');
        return;
    }

    await loadFromGist();
    updateSyncStatus('synced', 'Синхронизация завершена');
}

// Обновление статуса синхронизации
function updateSyncStatus(status, message) {
    const statusElement = document.getElementById('sync-status');
    const messageElement = document.getElementById('sync-message');
    
    statusElement.className = 'status-indicator';
    if (status === 'synced') {
        statusElement.classList.add('synced');
    } else if (status === 'pending') {
        statusElement.classList.add('pending');
    } else if (status === 'error') {
        statusElement.classList.add('error');
    }
    
    messageElement.textContent = message;
}

// Обновление UI синхронизации
function updateSyncUI() {
    const configSection = document.getElementById('sync-config');
    const infoSection = document.getElementById('sync-info');
    
    if (syncConfig.token) {
        configSection.style.display = 'none';
        infoSection.style.display = 'block';
        
        document.getElementById('current-gist-id').textContent = syncConfig.gistId || 'Не создан';
        document.getElementById('last-sync').textContent = 
            syncConfig.lastSync ? new Date(syncConfig.lastSync).toLocaleString() : 'Никогда';
        
        updateSyncStatus(syncConfig.lastSync ? 'synced' : 'pending', 
            syncConfig.lastSync ? 'Синхронизация настроена' : 'Настройте синхронизацию');
    } else {
        configSection.style.display = 'block';
        infoSection.style.display = 'none';
        updateSyncStatus('error', 'Синхронизация не настроена');
    }
}

// ==================== КАТЕГОРИИ ====================

// Рендеринг списка категорий
function renderCategoryList() {
    const categoryList = document.getElementById('category-list');
    categoryList.innerHTML = '';
    
    // Добавляем категорию "Все блюда"
    const allCategory = document.createElement('div');
    allCategory.className = `category-item all-dishes ${currentCategory === 'all' ? 'active' : ''}`;
    allCategory.textContent = 'Все блюда';
    allCategory.addEventListener('click', function() {
        currentCategory = 'all';
        renderCategoryList();
        renderDishList();
    });
    categoryList.appendChild(allCategory);
    
    // Добавляем остальные категории, отсортированные по алфавиту
    const sortedCategories = [...categories].sort();
    
    sortedCategories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.className = `category-item ${currentCategory === category ? 'active' : ''}`;
        categoryItem.textContent = category;
        categoryItem.addEventListener('click', function() {
            currentCategory = category;
            renderCategoryList();
            renderDishList();
        });
        categoryList.appendChild(categoryItem);
    });
}

// Рендеринг управления категориями
function renderCategoriesManagement() {
    const categoryItems = document.getElementById('category-items');
    categoryItems.innerHTML = '';
    
    const sortedCategories = [...categories].sort();
    
    if (sortedCategories.length === 0) {
        categoryItems.innerHTML = '<p>У вас пока нет категорий. Добавьте первую категорию!</p>';
        return;
    }
    
    sortedCategories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-item-management';
        
        const dishesInCategory = dishes.filter(dish => dish.category === category).length;
        
        categoryItem.innerHTML = `
            <div class="category-name">${category}</div>
            <div class="category-stats">${dishesInCategory} блюд</div>
            <button class="btn btn-danger btn-small delete-category" data-category="${category}">×</button>
        `;
        
        categoryItem.querySelector('.delete-category').addEventListener('click', function() {
            deleteCategory(category);
        });
        
        categoryItems.appendChild(categoryItem);
    });
}

// Обновление выпадающего списка категорий
function updateCategorySelect() {
    const categorySelect = document.getElementById('dish-category');
    categorySelect.innerHTML = '<option value="">Выберите категорию</option>';
    
    const sortedCategories = [...categories].sort();
    
    sortedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
}

// Добавление новой категории
async function addCategory() {
    const categoryName = document.getElementById('new-category-name').value.trim();
    
    if (!categoryName) {
        alert('Введите название категории');
        return;
    }
    
    if (categories.includes(categoryName)) {
        alert('Категория с таким названием уже существует');
        return;
    }
    
    categories.push(categoryName);
    await saveToGist();
    
    document.getElementById('new-category-name').value = '';
    renderCategoriesManagement();
    updateCategorySelect();
    renderCategoryList();
}

// Удаление категории
async function deleteCategory(categoryName) {
    if (!confirm(`Удалить категорию "${categoryName}"? Блюда в этой категории будут перемещены в категорию "Без категории".`)) {
        return;
    }
    
    // Перемещаем блюда в категорию "Без категории"
    dishes.forEach(dish => {
        if (dish.category === categoryName) {
            dish.category = '';
        }
    });
    
    // Удаляем категорию
    categories = categories.filter(cat => cat !== categoryName);
    
    await saveToGist();
    
    renderCategoriesManagement();
    updateCategorySelect();
    renderCategoryList();
    renderDishList();
}

// ==================== ОСНОВНЫЕ ФУНКЦИИ ====================

// Рендеринг планировщика на неделю
function renderWeekPlanner() {
    const weekPlanner = document.getElementById('week-planner');
    weekPlanner.innerHTML = '';
    
    const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    const meals = ['Завтрак', 'Обед', 'Ужин'];
    
    days.forEach(day => {
        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        
        const dayTitle = document.createElement('h3');
        dayTitle.textContent = day;
        dayCard.appendChild(dayTitle);
        
        meals.forEach(meal => {
            const mealSlot = document.createElement('div');
            mealSlot.className = 'meal-slot';
            mealSlot.setAttribute('data-day', day);
            mealSlot.setAttribute('data-meal', meal);
            
            const mealKey = `${currentWeek}-${currentMonth}-${currentYear}-${day}-${meal}`;
            const dish = weekPlan[mealKey];
            
            if (dish) {
                let imageHtml = '';
                if (dish.image) {
                    imageHtml = `<img src="${dish.image}" alt="${dish.name}" class="dish-image">`;
                }
                
                mealSlot.innerHTML = `
                    ${imageHtml}
                    <strong>${meal}</strong>
                    <div>${dish.name}</div>
                    <div class="nutrition-info">
                        <span>${dish.calories} ккал</span>
                    </div>
                    <button class="btn btn-small view-recipe-btn" style="margin-top: 5px; width: 100%;">Рецепт</button>
                `;
                
                mealSlot.querySelector('.view-recipe-btn').addEventListener('click', function(e) {
                    e.stopPropagation();
                    const dishIndex = dishes.findIndex(d => d.name === dish.name);
                    if (dishIndex !== -1) {
                        openRecipeModal(dishIndex);
                    }
                });
            } else {
                mealSlot.className += ' empty';
                mealSlot.innerHTML = `${meal} - Добавить блюдо`;
            }
            
            mealSlot.addEventListener('click', function() {
                currentMealSlot = {
                    week: currentWeek,
                    month: currentMonth,
                    year: currentYear,
                    day: day,
                    meal: meal
                };
                openDishSelectModal();
            });
            
            dayCard.appendChild(mealSlot);
        });
        
        weekPlanner.appendChild(dayCard);
    });
    
    updateWeekSummary();
    updateShoppingList();
}

// Рендеринг списка блюд с фильтрацией по категориям
function renderDishList() {
    const dishList = document.getElementById('dish-list');
    dishList.innerHTML = '';
    
    let filteredDishes = dishes;
    
    if (currentCategory !== 'all') {
        filteredDishes = dishes.filter(dish => dish.category === currentCategory);
    }
    
    if (filteredDishes.length === 0) {
        if (currentCategory === 'all') {
            dishList.innerHTML = '<p>У вас пока нет сохраненных блюд. Добавьте первое блюдо!</p>';
        } else {
            dishList.innerHTML = `<p>В категории "${currentCategory}" пока нет блюд.</p>`;
        }
        return;
    }
    
    filteredDishes.forEach((dish, index) => {
        const dishCard = document.createElement('div');
        dishCard.className = 'dish-card';
        
        let imageHtml = '';
        if (dish.image) {
            imageHtml = `<img src="${dish.image}" alt="${dish.name}" class="dish-image">`;
        }
        
        dishCard.innerHTML = `
            ${imageHtml}
            <h3>${dish.name}</h3>
            <div class="dish-category-badge">${dish.category || 'Без категории'}</div>
            <p>${dish.description || 'Описание отсутствует'}</p>
            <div class="nutrition-info">
                <div><span class="nutrition-value">${dish.calories}</span> ккал</div>
                <div>Б: <span class="nutrition-value">${dish.protein}</span> г</div>
                <div>Ж: <span class="nutrition-value">${dish.fat}</span> г</div>
                <div>У: <span class="nutrition-value">${dish.carbs}</span> г</div>
            </div>
            <button class="btn btn-small view-recipe-btn" style="margin-top: 10px; width: 100%;">Посмотреть рецепт</button>
        `;
        
        dishCard.addEventListener('click', function(e) {
            if (!e.target.classList.contains('view-recipe-btn')) {
                const globalIndex = dishes.findIndex(d => d.name === dish.name);
                if (globalIndex !== -1) {
                    openRecipeModal(globalIndex);
                }
            }
        });
        
        dishCard.querySelector('.view-recipe-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            const globalIndex = dishes.findIndex(d => d.name === dish.name);
            if (globalIndex !== -1) {
                openRecipeModal(globalIndex);
            }
        });
        
        dishList.appendChild(dishCard);
    });
}

// Рендеринг списка покупок
function renderShoppingList() {
    const shoppingListContainer = document.getElementById('shopping-list-container');
    shoppingListContainer.innerHTML = '';
    
    const currentWeekKey = `week-${currentWeek}-${currentMonth}-${currentYear}`;
    const weekShoppingList = shoppingList[currentWeekKey] || [];
    
    if (weekShoppingList.length === 0) {
        shoppingListContainer.innerHTML = '<p>Список покупок пуст. Добавьте блюда в план на неделю.</p>';
        return;
    }
    
    weekShoppingList.forEach((item, index) => {
        const shoppingItem = document.createElement('div');
        shoppingItem.className = `shopping-item ${item.checked ? 'checked' : ''}`;
        shoppingItem.setAttribute('draggable', 'true');
        shoppingItem.setAttribute('data-index', index);
        
        shoppingItem.innerHTML = `
            <div class="shopping-item-info">
                <div class="shopping-item-name">${item.name}</div>
                <div class="shopping-item-details">${item.amount} ${item.unit}</div>
            </div>
            <div class="shopping-item-actions">
                <input type="checkbox" class="shopping-item-checkbox" ${item.checked ? 'checked' : ''}>
            </div>
        `;
        
        shoppingItem.querySelector('.shopping-item-checkbox').addEventListener('change', async function() {
            weekShoppingList[index].checked = this.checked;
            shoppingList[currentWeekKey] = weekShoppingList;
            await saveToGist();
            renderShoppingList();
        });
        
        // Добавляем обработчики для перетаскивания
        shoppingItem.addEventListener('dragstart', handleDragStart);
        shoppingItem.addEventListener('dragover', handleDragOver);
        shoppingItem.addEventListener('dragenter', handleDragEnter);
        shoppingItem.addEventListener('dragleave', handleDragLeave);
        shoppingItem.addEventListener('drop', handleDrop);
        shoppingItem.addEventListener('dragend', handleDragEnd);
        
        shoppingListContainer.appendChild(shoppingItem);
    });
}

// Функции для перетаскивания элементов списка покупок
let dragSrcEl = null;

function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('over');
}

function handleDragLeave(e) {
    this.classList.remove('over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (dragSrcEl !== this) {
        const currentWeekKey = `week-${currentWeek}-${currentMonth}-${currentYear}`;
        const weekShoppingList = shoppingList[currentWeekKey] || [];
        
        const fromIndex = parseInt(dragSrcEl.getAttribute('data-index'));
        const toIndex = parseInt(this.getAttribute('data-index'));
        
        // Перемещаем элемент в массиве
        const [movedItem] = weekShoppingList.splice(fromIndex, 1);
        weekShoppingList.splice(toIndex, 0, movedItem);
        
        // Сохраняем изменения
        shoppingList[currentWeekKey] = weekShoppingList;
        saveToGist();
        renderShoppingList();
    }
    
    return false;
}

function handleDragEnd(e) {
    document.querySelectorAll('.shopping-item').forEach(item => {
        item.classList.remove('over');
        item.classList.remove('dragging');
    });
}

// Назначение блюда на слот
async function assignDishToSlot(dishIndex) {
    if (!currentMealSlot) return;
    
    const mealKey = `${currentMealSlot.week}-${currentMealSlot.month}-${currentMealSlot.year}-${currentMealSlot.day}-${currentMealSlot.meal}`;
    weekPlan[mealKey] = dishes[dishIndex];
    
    await saveToGist();
    renderWeekPlanner();
}

// Открытие модального окна выбора блюда
function openDishSelectModal() {
    const modal = document.getElementById('dish-select-modal');
    const dishList = document.getElementById('modal-dish-list');
    
    dishList.innerHTML = '';
    
    if (dishes.length === 0) {
        dishList.innerHTML = '<p>У вас пока нет сохраненных блюд. Добавьте первое блюдо!</p>';
    } else {
        dishes.forEach((dish, index) => {
            const dishCard = document.createElement('div');
            dishCard.className = 'dish-card';
            
            let imageHtml = '';
            if (dish.image) {
                imageHtml = `<img src="${dish.image}" alt="${dish.name}" class="dish-image">`;
            }
            
            dishCard.innerHTML = `
                ${imageHtml}
                <h3>${dish.name}</h3>
                <div class="dish-category-badge">${dish.category || 'Без категории'}</div>
                <p>${dish.description || 'Описание отсутствует'}</p>
                <div class="nutrition-info">
                    <div><span class="nutrition-value">${dish.calories}</span> ккал</div>
                    <div>Б: <span class="nutrition-value">${dish.protein}</span> г</div>
                    <div>Ж: <span class="nutrition-value">${dish.fat}</span> г</div>
                    <div>У: <span class="nutrition-value">${dish.carbs}</span> г</div>
                </div>
            `;
            
            dishCard.addEventListener('click', function() {
                assignDishToSlot(index);
                modal.classList.remove('active');
            });
            
            dishList.appendChild(dishCard);
        });
    }
    
    modal.classList.add('active');
}

// Открытие модального окна рецепта
function openRecipeModal(dishIndex) {
    const modal = document.getElementById('recipe-modal');
    const dish = dishes[dishIndex];
    
    document.getElementById('recipe-dish-name').textContent = dish.name;
    
    let imageHtml = '';
    if (dish.image) {
        imageHtml = `<img src="${dish.image}" alt="${dish.name}" class="recipe-image">`;
    }
    
    let ingredientsHtml = '';
    if (dish.ingredients && dish.ingredients.length > 0) {
        ingredientsHtml = '<div class="recipe-section"><h4>Ингредиенты:</h4><ul class="recipe-ingredients">';
        dish.ingredients.forEach(ingredient => {
            ingredientsHtml += `<li>${ingredient.name} - ${ingredient.amount} ${ingredient.unit}</li>`;
        });
        ingredientsHtml += '</ul></div>';
    }
    
    let stepsHtml = '';
    if (dish.steps && dish.steps.length > 0) {
        stepsHtml = '<div class="recipe-section"><h4>Шаги приготовления:</h4><ol class="recipe-steps">';
        dish.steps.forEach(step => {
            stepsHtml += `<li>${step}</li>`;
        });
        stepsHtml += '</ol></div>';
    }
    
    document.getElementById('recipe-content').innerHTML = `
        ${imageHtml}
        <div class="recipe-section">
            <p><strong>Категория:</strong> ${dish.category || 'Без категории'}</p>
            <p><strong>Описание:</strong> ${dish.description || 'Отсутствует'}</p>
        </div>
        <div class="recipe-section">
            <h4>Пищевая ценность (на 100г):</h4>
            <div class="nutrition-info" style="margin: 15px 0;">
                <div><strong>Калории:</strong> ${dish.calories} ккал</div>
                <div><strong>Белки:</strong> ${dish.protein} г</div>
                <div><strong>Жиры:</strong> ${dish.fat} г</div>
                <div><strong>Углеводы:</strong> ${dish.carbs} г</div>
            </div>
        </div>
        ${ingredientsHtml}
        ${stepsHtml}
    `;
    
    document.getElementById('recipe-actions').innerHTML = `
        <button class="btn" id="edit-recipe-btn" data-index="${dishIndex}">Редактировать рецепт</button>
        <button class="btn btn-danger" id="delete-recipe-btn" data-index="${dishIndex}">Удалить рецепт</button>
    `;
    
    document.getElementById('edit-recipe-btn').addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-index'));
        editDish(index);
        modal.classList.remove('active');
    });
    
    document.getElementById('delete-recipe-btn').addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-index'));
        showDeleteConfirmation(index);
    });
    
    modal.classList.add('active');
}

// Показать подтверждение удаления
function showDeleteConfirmation(index) {
    const dish = dishes[index];
    document.getElementById('confirmation-message').textContent = 
        `Вы уверены, что хотите удалить рецепт "${dish.name}"?`;
    dishToDelete = index;
    document.getElementById('confirmation-modal').classList.add('active');
}

// Редактирование блюда
function editDish(index) {
    const dish = dishes[index];
    
    document.getElementById('dish-form-title').textContent = 'Редактировать блюдо';
    document.getElementById('edit-dish-index').value = index;
    document.getElementById('dish-name').value = dish.name;
    document.getElementById('dish-category').value = dish.category || '';
    document.getElementById('dish-description').value = dish.description || '';
    document.getElementById('dish-calories').value = dish.calories;
    document.getElementById('dish-protein').value = dish.protein;
    document.getElementById('dish-fat').value = dish.fat;
    document.getElementById('dish-carbs').value = dish.carbs;
    
    if (dish.image) {
        document.getElementById('image-preview').innerHTML = `<img src="${dish.image}" alt="Preview">`;
    } else {
        document.getElementById('image-preview').innerHTML = 'Превью изображения';
    }
    
    document.getElementById('ingredient-list').innerHTML = '';
    if (dish.ingredients && dish.ingredients.length > 0) {
        dish.ingredients.forEach(ingredient => {
            addIngredientField(ingredient.name, ingredient.amount, ingredient.unit);
        });
    } else {
        addIngredientField();
    }
    
    document.getElementById('step-list').innerHTML = '';
    if (dish.steps && dish.steps.length > 0) {
        dish.steps.forEach(step => {
            addStepField(step);
        });
    } else {
        addStepField();
    }
    
    document.getElementById('cancel-edit').style.display = 'inline-block';
    document.getElementById('save-dish-btn').textContent = 'Обновить блюдо';
    
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    document.querySelector('[data-section="add-dish"]').classList.add('active');
    document.getElementById('add-dish').classList.add('active');
}

// Удаление блюда
async function deleteDish(index) {
    const dishName = dishes[index].name;
    
    // Удаляем блюдо из плана на неделю
    Object.keys(weekPlan).forEach(key => {
        if (weekPlan[key].name === dishName) {
            delete weekPlan[key];
        }
    });
    
    dishes.splice(index, 1);
    
    await saveToGist();
    
    renderDishList();
    renderWeekPlanner();
    updateStatistics();
}

// Сохранение блюда
async function saveDish() {
    const name = document.getElementById('dish-name').value;
    const category = document.getElementById('dish-category').value;
    const description = document.getElementById('dish-description').value;
    const calories = parseInt(document.getElementById('dish-calories').value);
    const protein = parseFloat(document.getElementById('dish-protein').value);
    const fat = parseFloat(document.getElementById('dish-fat').value);
    const carbs = parseFloat(document.getElementById('dish-carbs').value);
    const editIndex = parseInt(document.getElementById('edit-dish-index').value);
    
    const imageFile = document.getElementById('dish-image').files[0];
    
    if (imageFile) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            await completeSaveDish(name, category, description, calories, protein, fat, carbs, e.target.result, editIndex);
        };
        reader.readAsDataURL(imageFile);
    } else {
        const existingImage = editIndex !== -1 ? dishes[editIndex].image : null;
        await completeSaveDish(name, category, description, calories, protein, fat, carbs, existingImage, editIndex);
    }
}

// Завершение сохранения блюда
async function completeSaveDish(name, category, description, calories, protein, fat, carbs, imageBase64, editIndex) {
    const ingredients = [];
    document.querySelectorAll('.ingredient-item').forEach(item => {
        const name = item.querySelector('.ingredient-name').value;
        const amount = item.querySelector('.ingredient-amount').value;
        const unit = item.querySelector('.ingredient-unit').value;
        
        if (name && amount) {
            ingredients.push({ name, amount, unit });
        }
    });
    
    const steps = [];
    document.querySelectorAll('.step-item').forEach(item => {
        const description = item.querySelector('.step-description').value;
        
        if (description) {
            steps.push(description);
        }
    });
    
    const dishData = {
        name,
        category,
        description,
        calories,
        protein,
        fat,
        carbs,
        ingredients,
        steps,
        image: imageBase64
    };
    
    if (editIndex !== -1) {
        const oldName = dishes[editIndex].name;
        dishes[editIndex] = dishData;
        
        // Обновляем блюдо в плане на неделю
        Object.keys(weekPlan).forEach(key => {
            if (weekPlan[key].name === oldName) {
                weekPlan[key] = dishData;
            }
        });
    } else {
        dishes.push(dishData);
    }
    
    await saveToGist();
    
    resetDishForm();
    renderDishList();
    renderWeekPlanner();
    updateStatistics();
}

// Сброс формы блюда
function resetDishForm() {
    document.getElementById('dish-form').reset();
    document.getElementById('dish-form-title').textContent = 'Добавить новое блюдо';
    document.getElementById('edit-dish-index').value = '-1';
    document.getElementById('ingredient-list').innerHTML = '';
    document.getElementById('step-list').innerHTML = '';
    document.getElementById('image-preview').innerHTML = 'Превью изображения';
    document.getElementById('cancel-edit').style.display = 'none';
    document.getElementById('save-dish-btn').textContent = 'Сохранить блюдо';
    
    addIngredientField();
    addStepField();
}

// Добавление поля ингредиента (ИСПРАВЛЕН БАГ)
function addIngredientField(name = '', amount = '', unit = 'г') {
    const ingredientList = document.getElementById('ingredient-list');
    const ingredientItem = document.createElement('div');
    ingredientItem.className = 'ingredient-item';
    
    let unitOptions = '';
    measurementUnits.forEach(u => {
        unitOptions += `<option value="${u}" ${u === unit ? 'selected' : ''}>${u}</option>`;
    });
    
    ingredientItem.innerHTML = `
        <input type="text" placeholder="Название ингредиента" class="ingredient-name" value="${name}">
        <input type="text" placeholder="Количество" class="ingredient-amount" value="${amount}">
        <select class="ingredient-unit">
            ${unitOptions}
        </select>
        <button type="button" class="btn btn-danger btn-small remove-ingredient">×</button>
    `;
    
    ingredientItem.querySelector('.remove-ingredient').addEventListener('click', function() {
        ingredientItem.remove();
    });
    
    ingredientList.appendChild(ingredientItem);
}

// Добавление поля шага приготовления
function addStepField(description = '') {
    const stepList = document.getElementById('step-list');
    const stepItem = document.createElement('div');
    stepItem.className = 'step-item';
    stepItem.innerHTML = `
        <input type="text" placeholder="Описание шага" class="step-description" value="${description}">
        <button type="button" class="btn btn-danger btn-small remove-step">×</button>
    `;
    
    stepItem.querySelector('.remove-step').addEventListener('click', function() {
        stepItem.remove();
    });
    
    stepList.appendChild(stepItem);
}

// Обновление сводки за неделю
function updateWeekSummary() {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;
    
    Object.values(weekPlan).forEach(dish => {
        totalCalories += dish.calories;
        totalProtein += dish.protein;
        totalFat += dish.fat;
        totalCarbs += dish.carbs;
    });
    
    document.getElementById('weekly-calories').textContent = totalCalories;
    document.getElementById('weekly-protein').textContent = totalProtein.toFixed(1);
    document.getElementById('weekly-fat').textContent = totalFat.toFixed(1);
    document.getElementById('weekly-carbs').textContent = totalCarbs.toFixed(1);
}

// Обновление списка покупок
async function updateShoppingList() {
    const currentWeekKey = `week-${currentWeek}-${currentMonth}-${currentYear}`;
    const weekIngredients = {};
    
    Object.values(weekPlan).forEach(dish => {
        if (dish.ingredients) {
            dish.ingredients.forEach(ingredient => {
                const key = `${ingredient.name}-${ingredient.unit}`;
                if (!weekIngredients[key]) {
                    weekIngredients[key] = {
                        name: ingredient.name,
                        amount: 0,
                        unit: ingredient.unit,
                        checked: false
                    };
                }
                
                const amount = parseFloat(ingredient.amount);
                if (!isNaN(amount)) {
                    weekIngredients[key].amount += amount;
                }
            });
        }
    });
    
    const shoppingArray = Object.values(weekIngredients);
    
    const existingList = shoppingList[currentWeekKey] || [];
    const checkedItems = {};
    existingList.forEach(item => {
        const key = `${item.name}-${item.unit}`;
        if (item.checked) {
            checkedItems[key] = true;
        }
    });
    
    shoppingArray.forEach(item => {
        const key = `${item.name}-${item.unit}`;
        if (checkedItems[key]) {
            item.checked = true;
        }
    });
    
    shoppingList[currentWeekKey] = shoppingArray;
    await saveToGist();
}

// Обновление статистики
function updateStatistics() {
    document.getElementById('total-dishes').textContent = dishes.length;
    
    let totalWeeklyCalories = 0;
    Object.values(weekPlan).forEach(dish => {
        totalWeeklyCalories += dish.calories;
    });
    
    const avgCalories = dishes.length > 0 ? 
        Math.round(totalWeeklyCalories / 7) : 0;
    document.getElementById('avg-calories').textContent = avgCalories;
    
    const dishCount = {};
    Object.values(weekPlan).forEach(dish => {
        dishCount[dish.name] = (dishCount[dish.name] || 0) + 1;
    });
    
    let favoriteDish = '-';
    let maxCount = 0;
    
    for (const [name, count] of Object.entries(dishCount)) {
        if (count > maxCount) {
            maxCount = count;
            favoriteDish = name;
        }
    }
    
    document.getElementById('favorite-dish').textContent = favoriteDish;
    
    const dayCalories = {};
    Object.entries(weekPlan).forEach(([key, dish]) => {
        const day = key.split('-')[3]; // Изменен индекс из-за нового формата ключа
        dayCalories[day] = (dayCalories[day] || 0) + dish.calories;
    });
    
    let maxCaloriesDay = 'Понедельник';
    let maxCalories = 0;
    
    for (const [day, calories] of Object.entries(dayCalories)) {
        if (calories > maxCalories) {
            maxCalories = calories;
            maxCaloriesDay = day;
        }
    }
    
    document.getElementById('max-calories-day').textContent = maxCaloriesDay;
    document.getElementById('max-calories-value').textContent = `${maxCalories} ккал`;
}

// Обновление заголовка недели
function updateWeekTitle() {
    document.getElementById('week-month').value = currentMonth;
    document.getElementById('week-number').value = currentWeek;
    document.getElementById('week-year').value = currentYear;
}

// Экспорт данных
function exportData() {
    const data = {
        dishes,
        weekPlan,
        shoppingList,
        categories,
        currentWeek,
        currentMonth,
        currentYear,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meal-planner-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Импорт данных
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            dishes = data.dishes || dishes;
            weekPlan = data.weekPlan || weekPlan;
            shoppingList = data.shoppingList || shoppingList;
            categories = data.categories || categories;
            currentWeek = data.currentWeek || currentWeek;
            currentMonth = data.currentMonth || currentMonth;
            currentYear = data.currentYear || currentYear;
            
            await saveToGist();
            
            renderWeekPlanner();
            renderCategoryList();
            renderDishList();
            renderCategoriesManagement();
            updateCategorySelect();
            renderShoppingList();
            updateStatistics();
            updateWeekTitle();
            
            alert('Данные успешно импортированы!');
        } catch (error) {
            alert('Ошибка импорта: неверный формат файла');
        }
    };
    reader.readAsText(file);
    
    event.target.value = '';
}

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================

function setupEventListeners() {
    // Навигация по неделям
    document.getElementById('prev-week').addEventListener('click', function() {
        if (currentWeek > 1) {
            currentWeek--;
            updateWeekTitle();
            renderWeekPlanner();
            saveToGist();
        }
    });
    
    document.getElementById('next-week').addEventListener('click', function() {
        currentWeek++;
        updateWeekTitle();
        renderWeekPlanner();
        saveToGist();
    });
    
    // Обновление даты
    document.getElementById('week-month').addEventListener('change', function() {
        currentMonth = this.value;
        saveToGist();
    });
    
    document.getElementById('week-number').addEventListener('change', function() {
        currentWeek = parseInt(this.value);
        saveToGist();
    });
    
    document.getElementById('week-year').addEventListener('change', function() {
        currentYear = parseInt(this.value);
        saveToGist();
    });
    
    // Форма блюда
    document.getElementById('dish-form').addEventListener('submit', function(e) {
        e.preventDefault();
        saveDish();
    });
    
    document.getElementById('cancel-edit').addEventListener('click', resetDishForm);
    
    document.getElementById('dish-image').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('image-preview').innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        }
    });
    
    document.getElementById('add-ingredient').addEventListener('click', function() {
        addIngredientField();
    });
    
    document.getElementById('add-step').addEventListener('click', function() {
        addStepField();
    });
    
    // Категории
    document.getElementById('add-category').addEventListener('click', addCategory);
    
    // Синхронизация
    document.getElementById('setup-sync').addEventListener('click', function() {
        document.getElementById('sync-config').style.display = 'block';
    });
    
    document.getElementById('save-sync-config').addEventListener('click', async function() {
        const token = document.getElementById('github-token').value;
        const gistId = document.getElementById('gist-id').value;
        
        if (!token) {
            alert('Введите GitHub Personal Access Token');
            return;
        }
        
        syncConfig.token = token;
        if (gistId) syncConfig.gistId = gistId;
        
        localStorage.setItem('syncConfig', JSON.stringify(syncConfig));
        updateSyncUI();
        
        await loadFromGist();
    });
    
    document.getElementById('manual-sync').addEventListener('click', forceSync);
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('import-data').addEventListener('click', function() {
        document.getElementById('import-file').click();
    });
    
    document.getElementById('disable-sync').addEventListener('click', function() {
        if (confirm('Отключить синхронизацию? Все данные будут потеряны!')) {
            syncConfig = {};
            localStorage.removeItem('syncConfig');
            dishes = [];
            weekPlan = {};
            shoppingList = {};
            categories = ['Завтраки', 'Обеды', 'Ужины', 'Десерты', 'Салаты'];
            currentWeek = 1;
            currentMonth = 'Январь';
            currentYear = 2023;
            updateSyncUI();
            renderWeekPlanner();
            renderCategoryList();
            renderDishList();
            renderCategoriesManagement();
            updateCategorySelect();
            renderShoppingList();
            updateStatistics();
            updateWeekTitle();
        }
    });
    
    // Модальные окна
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('active');
            });
        });
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
    
    document.getElementById('confirm-delete').addEventListener('click', function() {
        if (dishToDelete !== null) {
            deleteDish(dishToDelete);
            document.getElementById('confirmation-modal').classList.remove('active');
            dishToDelete = null;
        }
    });
    
    document.getElementById('cancel-delete').addEventListener('click', function() {
        document.getElementById('confirmation-modal').classList.remove('active');
        dishToDelete = null;
    });
    
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.json';
    importInput.id = 'import-file';
    importInput.style.display = 'none';
    importInput.addEventListener('change', importData);
    document.body.appendChild(importInput);
}

// Инициализация пустых полей при загрузке
addIngredientField();
addStepField();
updateWeekTitle();