// Данные приложения - только в памяти
let dishes = [];
let weekPlan = {};
let shoppingList = {};
let categories = ['Завтраки', 'Обеды', 'Ужины', 'Десерты', 'Салаты'];
let currentCategory = 'all';
let mealsPerDay = {
    'Понедельник': 3,
    'Вторник': 3,
    'Среда': 3,
    'Четверг': 3,
    'Пятница': 3,
    'Суббота': 3,
    'Воскресенье': 3
};
let searchQuery = '';
let modalSearchQuery = '';
let modalCategoryFilter = 'all';
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
    console.log('Инициализация приложения...');
    try {
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
            updateCategoriesSelect();
            renderShoppingList();
            updateWeekSummary();
        }
        console.log('Приложение успешно инициализировано');
    } catch (error) {
        console.error('Ошибка инициализации:', error);
    }
});

// ==================== СЕРВЕРНЫЕ ОПЕРАЦИИ (ОПТИМИЗИРОВАННЫЕ) ====================

// Улучшенная функция для безопасного парсинга JSON с восстановлением
function safeJSONParse(text) {
    try {
        return JSON.parse(text);
    } catch (parseError) {
        console.error('Ошибка парсинга JSON, пытаемся восстановить:', parseError);
        
        // Пытаемся восстановить битый JSON
        try {
            let fixedText = text;
            
            // 1. Удаляем проблемные символы
            fixedText = fixedText
                .replace(/\u0000/g, '') // null bytes
                .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // control characters
                .replace(/\\"/g, '"') // Экранированные кавычки
                .replace(/\n/g, '\\n') // Переносы строк
                .replace(/\r/g, '\\r') // Возвраты каретки
                .replace(/\t/g, '\\t'); // Табуляции

            // 2. Находим позицию ошибки и обрезаем до последнего валидного места
            const errorPosition = 921079; // Из ошибки в консоли
            if (errorPosition < fixedText.length) {
                console.log('Обрезаем данные на позиции:', errorPosition);
                
                // Ищем последнюю закрывающую кавычку перед ошибкой
                const lastValidQuote = fixedText.lastIndexOf('"', errorPosition - 100);
                if (lastValidQuote !== -1) {
                    // Ищем следующую кавычку после последней валидной
                    const nextQuote = fixedText.indexOf('"', lastValidQuote + 1);
                    if (nextQuote !== -1 && nextQuote < errorPosition) {
                        // Обрезаем после следующей кавычки
                        fixedText = fixedText.substring(0, nextQuote + 1);
                    } else {
                        // Просто обрезаем перед ошибкой
                        fixedText = fixedText.substring(0, errorPosition - 100);
                    }
                } else {
                    // Просто обрезаем перед ошибкой
                    fixedText = fixedText.substring(0, errorPosition - 100);
                }
            }

            // 3. Завершаем JSON если он оборван
            let openBraces = (fixedText.match(/{/g) || []).length;
            let closeBraces = (fixedText.match(/}/g) || []).length;
            let openBrackets = (fixedText.match(/\[/g) || []).length;
            let closeBrackets = (fixedText.match(/\]/g) || []).length;

            // Добавляем недостающие закрывающие скобки
            while (openBraces > closeBraces) {
                fixedText += '}';
                closeBraces++;
            }
            
            while (openBrackets > closeBrackets) {
                fixedText += ']';
                closeBrackets++;
            }

            // 4. Проверяем, что последний элемент массива или объекта завершен
            const lastComma = fixedText.lastIndexOf(',');
            const lastBrace = fixedText.lastIndexOf('}');
            const lastBracket = fixedText.lastIndexOf(']');
            
            if (lastComma > Math.max(lastBrace, lastBracket)) {
                // Удаляем запятую в конце
                fixedText = fixedText.substring(0, lastComma) + fixedText.substring(lastComma + 1);
            }

            console.log('Восстановленный JSON, длина:', fixedText.length);
            
            const result = JSON.parse(fixedText);
            console.log('JSON успешно восстановлен');
            return result;
            
        } catch (recoveryError) {
            console.error('Не удалось восстановить JSON, создаем пустые данные:', recoveryError);
            
            // Создаем пустые данные как запасной вариант
            return {
                dishes: [],
                weekPlan: {},
                shoppingList: {},
                categories: ['Завтраки', 'Обеды', 'Ужины', 'Десерты', 'Салаты'],
                mealsPerDay: mealsPerDay,
                lastSync: new Date().toISOString(),
                recovered: true
            };
        }
    }
}

// Функция для разделения данных - выносим изображения в отдельный Gist
async function saveToSeparateGists() {
    if (!syncConfig.token || isSyncing) return;

    isSyncing = true;
    updateSyncStatus('pending', 'Сохранение данных (раздельное)...');

    try {
        // Основные данные БЕЗ изображений
        const mainData = {
            dishes: dishes.map(dish => ({
                name: dish.name,
                categories: dish.categories,
                description: dish.description,
                calories: dish.calories,
                protein: dish.protein,
                fat: dish.fat,
                carbs: dish.carbs,
                ingredients: dish.ingredients,
                steps: dish.steps,
                // Сохраняем только флаг что изображение есть
                hasImage: !!dish.image
            })),
            weekPlan,
            shoppingList,
            categories,
            mealsPerDay,
            lastSync: new Date().toISOString(),
            version: '1.1'
        };

        console.log('💾 Сохранение основных данных, блюд:', dishes.length);

        const mainGistData = {
            files: {
                'meal-planner-data.json': {
                    content: JSON.stringify(mainData, null, 0)
                }
            },
            description: 'Meal Planner Main Data - ' + new Date().toLocaleDateString()
        };

        let response = await fetch(`https://api.github.com/gists/${syncConfig.gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${syncConfig.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(mainGistData)
        });

        if (!response.ok) {
            throw new Error('Ошибка сохранения основных данных: ' + response.status);
        }

        // Сохраняем изображения в отдельный Gist (если они есть)
        const dishesWithImages = dishes.filter(dish => dish.image);
        console.log('🖼️ Блюд с изображениями для сохранения:', dishesWithImages.length);

        if (dishesWithImages.length > 0) {
            const imagesData = {
                images: {},
                lastSync: new Date().toISOString(),
                dishCount: dishesWithImages.length
            };

            // Собираем только изображения
            dishesWithImages.forEach(dish => {
                if (dish.image) {
                    imagesData.images[dish.name] = dish.image;
                }
            });

            const imagesGistData = {
                files: {
                    'meal-planner-images.json': {
                        content: JSON.stringify(imagesData, null, 0)
                    }
                },
                description: 'Meal Planner Images - ' + new Date().toLocaleDateString()
            };

            // Используем отдельный Gist для изображений
            if (syncConfig.imagesGistId) {
                console.log('🔄 Обновление Gist с изображениями:', syncConfig.imagesGistId);
                response = await fetch(`https://api.github.com/gists/${syncConfig.imagesGistId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `token ${syncConfig.token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/vnd.github.v3+json'
                    },
                    body: JSON.stringify(imagesGistData)
                });
            } else {
                console.log('🆕 Создание нового Gist для изображений');
                response = await fetch('https://api.github.com/gists', {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${syncConfig.token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/vnd.github.v3+json'
                    },
                    body: JSON.stringify(imagesGistData)
                });

                if (response.ok) {
                    const result = await response.json();
                    syncConfig.imagesGistId = result.id;
                    localStorage.setItem('syncConfig', JSON.stringify(syncConfig));
                    console.log('✅ Создан отдельный Gist для изображений:', result.id);
                }
            }

            if (response.ok) {
                console.log('✅ Изображения сохранены в отдельный Gist');
            } else {
                console.error('❌ Ошибка сохранения изображений:', response.status);
            }
        } else {
            console.log('ℹ️ Нет изображений для сохранения');
        }

        syncConfig.lastSync = new Date().toISOString();
        localStorage.setItem('syncConfig', JSON.stringify(syncConfig));

        updateSyncStatus('synced', 'Данные сохранены');
        console.log('✅ Все данные сохранены в раздельные Gist');

    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        updateSyncStatus('error', 'Ошибка сохранения: ' + error.message);
    } finally {
        isSyncing = false;
    }
}

// Оптимизированная загрузка данных с сервера
async function loadFromGist() {
    if (!syncConfig.token || !syncConfig.gistId || isSyncing) return;

    isSyncing = true;
    updateSyncStatus('pending', 'Загрузка данных...');

    try {
        const response = await fetch(`https://api.github.com/gists/${syncConfig.gistId}`, {
            headers: {
                'Authorization': `token ${syncConfig.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.ok) {
            const text = await response.text();
            console.log('📥 Получены сырые данные, длина:', text.length);

            const gist = safeJSONParse(text);
            const file = gist.files['meal-planner-data.json'];

            if (file && file.content) {
                console.log('📄 Содержимое файла получено, длина:', file.content.length);
                const serverData = safeJSONParse(file.content);
                console.log('✅ Данные загружены с сервера, блюд:', (serverData.dishes || []).length);

                // Восстанавливаем данные
                dishes = serverData.dishes || [];
                weekPlan = serverData.weekPlan || {};
                shoppingList = serverData.shoppingList || {};
                categories = serverData.categories || categories;

                // Восстанавливаем mealsPerDay
                if (serverData.mealsPerDay) {
                    const currentMealsPerDay = {...mealsPerDay};
                    mealsPerDay = {...currentMealsPerDay, ...serverData.mealsPerDay};
                }

                // ВСЕГДА загружаем изображения если есть imagesGistId
                if (syncConfig.imagesGistId) {
                    console.log('🖼️ Загрузка изображений...');
                    await loadImagesFromGist();
                } else {
                    console.log('ℹ️ Нет отдельного Gist для изображений');
                }

                // Обновляем интерфейс
                renderWeekPlanner();
                renderCategoryList();
                renderDishList();
                renderCategoriesManagement();
                updateCategoriesSelect();
                renderShoppingList();
                updateWeekSummary();

                updateSyncStatus('synced', 'Данные загружены');
            } else {
                console.log('❌ Файл не найден, создаем новый');
                await saveToGist();
            }
        } else {
            throw new Error('Ошибка загрузки: ' + response.status);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        updateSyncStatus('error', 'Ошибка загрузки: ' + error.message);

        // Показываем пустой интерфейс при ошибке
        dishes = [];
        weekPlan = {};
        shoppingList = {};
        renderWeekPlanner();
        renderCategoryList();
        renderDishList();
        renderCategoriesManagement();
        updateCategoriesSelect();
        renderShoppingList();
        updateWeekSummary();
    } finally {
        isSyncing = false;
        updateSyncUI();
    }
}

// Загрузка изображений из отдельного Gist
async function loadImagesFromGist() {
    if (!syncConfig.imagesGistId) {
        console.log('❌ Нет ID Gist для изображений');
        return;
    }

    try {
        console.log('🔄 Загрузка изображений из Gist:', syncConfig.imagesGistId);
        const response = await fetch(`https://api.github.com/gists/${syncConfig.imagesGistId}`, {
            headers: {
                'Authorization': `token ${syncConfig.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            console.error('❌ Ошибка загрузки Gist с изображениями:', response.status);
            return;
        }

        const gist = await response.json();
        const file = gist.files['meal-planner-images.json'];

        if (!file || !file.content) {
            console.log('❌ Файл с изображениями не найден или пуст');
            return;
        }

        const imagesData = JSON.parse(file.content);
        console.log('✅ Данные изображений загружены, количество:', Object.keys(imagesData.images || {}).length);

        // Восстанавливаем изображения для блюд
        let restoredCount = 0;
        dishes.forEach(dish => {
            if (imagesData.images && imagesData.images[dish.name]) {
                dish.image = imagesData.images[dish.name];
                restoredCount++;
            }
        });

        console.log(`✅ Восстановлено изображений: ${restoredCount} из ${dishes.length} блюд`);

        // Обновляем интерфейс чтобы показать изображения
        renderDishList();
        renderWeekPlanner();

    } catch (error) {
        console.error('❌ Ошибка загрузки изображений:', error);
    }
}

// Оптимизированное сохранение данных на сервер
async function saveToGist() {
    // Если данные большие (больше 1MB), используем раздельное сохранение
    const testSize = JSON.stringify(dishes).length;
    console.log('Размер данных для сохранения:', (testSize / 1024 / 1024).toFixed(2), 'MB');
    
    if (testSize > 500000) { // Если больше 500KB
        console.log('Используем раздельное сохранение из-за большого размера данных');
        await saveToSeparateGists();
        return;
    }

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
            mealsPerDay,
            lastSync: new Date().toISOString(),
            version: '1.0'
        };

        console.log('Сохранение данных, количество блюд:', dishes.length);

        const gistData = {
            files: {
                'meal-planner-data.json': {
                    content: JSON.stringify(data, null, 0) // Убираем форматирование для экономии места
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
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify(gistData)
            });
        } else {
            // Создаем новый Gist
            response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${syncConfig.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
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
        
        // Пробуем использовать раздельное сохранение как запасной вариант
        console.log('Пробуем раздельное сохранение как запасной вариант...');
        await saveToSeparateGists();
    } finally {
        isSyncing = false;
    }
}

// Функция для оптимизации изображений перед сохранением
function optimizeImageBeforeSave(base64String, maxWidth = 400, quality = 0.6) {
    return new Promise((resolve) => {
        // Если изображение маленькое, возвращаем как есть
        if (!base64String || base64String.length < 10000) {
            resolve(base64String);
            return;
        }

        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Уменьшаем размер если нужно
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Сжимаем изображение
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            console.log('Изображение оптимизировано:', 
                (base64String.length / 1024).toFixed(1) + 'KB -> ' + 
                (compressedBase64.length / 1024).toFixed(1) + 'KB');
            
            resolve(compressedBase64);
        };
        
        img.onerror = function() {
            console.warn('Не удалось оптимизировать изображение, используем оригинал');
            resolve(base64String);
        };
        
        img.src = base64String;
    });
}

// Очистка старых данных для уменьшения размера
function cleanupOldData() {
    console.log('Очистка старых данных...');
    
    // Очищаем старые недели из shoppingList
    const currentWeekKey = 'current-week';
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    Object.keys(shoppingList).forEach(key => {
        if (key !== currentWeekKey) {
            delete shoppingList[key];
        }
    });
    
    console.log('✅ Старые данные очищены');
}

// Модифицированная функция сохранения блюда с оптимизацией изображений
async function saveDish() {
    const name = document.getElementById('dish-name')?.value;
    const categories = getSelectedCategories();
    const description = document.getElementById('dish-description')?.value;
    const calories = parseInt(document.getElementById('dish-calories')?.value);
    const protein = parseFloat(document.getElementById('dish-protein')?.value);
    const fat = parseFloat(document.getElementById('dish-fat')?.value);
    const carbs = parseFloat(document.getElementById('dish-carbs')?.value);
    const editIndex = parseInt(document.getElementById('edit-dish-index')?.value);
    
    if (!name || isNaN(calories) || isNaN(protein) || isNaN(fat) || isNaN(carbs)) {
        alert('Пожалуйста, заполните все обязательные поля корректно');
        return;
    }

    const imageFile = document.getElementById('dish-image')?.files[0];
    
    if (imageFile) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            // Оптимизируем изображение перед сохранением
            const optimizedImage = await optimizeImageBeforeSave(e.target.result);
            await completeSaveDish(name, categories, description, calories, protein, fat, carbs, optimizedImage, editIndex);
        };
        reader.readAsDataURL(imageFile);
    } else {
        const existingImage = editIndex !== -1 ? dishes[editIndex].image : null;
        await completeSaveDish(name, categories, description, calories, protein, fat, carbs, existingImage, editIndex);
    }
}

// ==================== ОСТАЛЬНЫЕ ФУНКЦИИ БЕЗ ИЗМЕНЕНИЙ ====================

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

// Принудительная синхронизация
async function forceSync() {
    if (!syncConfig.token) {
        alert('Сначала настройте синхронизацию');
        return;
    }

    // Очищаем старые данные перед синхронизацией
    cleanupOldData();
    
    await loadFromGist();
    updateSyncStatus('synced', 'Синхронизация завершена');
}

// Обновление статуса синхронизации
function updateSyncStatus(status, message) {
    const statusElement = document.getElementById('sync-status');
    const messageElement = document.getElementById('sync-message');
    
    if (statusElement && messageElement) {
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
}

// Обновление UI синхронизации
function updateSyncUI() {
    const configSection = document.getElementById('sync-config');
    const infoSection = document.getElementById('sync-info');
    
    if (configSection && infoSection) {
        if (syncConfig.token) {
            configSection.style.display = 'none';
            infoSection.style.display = 'block';
            
            const currentGistId = document.getElementById('current-gist-id');
            const lastSync = document.getElementById('last-sync');
            
            if (currentGistId) currentGistId.textContent = syncConfig.gistId || 'Не создан';
            if (lastSync) lastSync.textContent = 
                syncConfig.lastSync ? new Date(syncConfig.lastSync).toLocaleString() : 'Никогда';
            
            updateSyncStatus(syncConfig.lastSync ? 'synced' : 'pending', 
                syncConfig.lastSync ? 'Синхронизация настроена' : 'Настройте синхронизацию');
        } else {
            configSection.style.display = 'block';
            infoSection.style.display = 'none';
            updateSyncStatus('error', 'Синхронизация не настроена');
        }
    }
}

// ==================== КАТЕГОРИИ ====================

// Рендеринг списка категорий
function renderCategoryList() {
    const categoryList = document.getElementById('category-list');
    if (!categoryList) return;
    
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
    if (!categoryItems) return;
    
    categoryItems.innerHTML = '';
    
    const sortedCategories = [...categories].sort();
    
    if (sortedCategories.length === 0) {
        categoryItems.innerHTML = '<p>У вас пока нет категорий. Добавьте первую категорию!</p>';
        return;
    }
    
    sortedCategories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-item-management';
        
        const dishesInCategory = dishes.filter(dish => 
            dish.categories && dish.categories.includes(category)
        ).length;
        
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

// Обновление выбора категорий в форме
function updateCategoriesSelect() {
    const categoriesSelect = document.getElementById('categories-select');
    if (!categoriesSelect) return;
    
    categoriesSelect.innerHTML = '';
    
    const sortedCategories = [...categories].sort();
    
    sortedCategories.forEach(category => {
        const checkboxId = `category-${category.replace(/\s+/g, '-')}`;
        
        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.innerHTML = `
            <input type="checkbox" id="${checkboxId}" class="category-checkbox" value="${category}">
            <label for="${checkboxId}" class="category-checkbox-label">${category}</label>
        `;
        
        categoriesSelect.appendChild(checkboxWrapper);
    });
}

// Обновление фильтра категорий в модальном окне
function updateModalCategoryFilter() {
    const categoryFilter = document.getElementById('modal-category-filter');
    if (!categoryFilter) return;
    
    categoryFilter.innerHTML = '<option value="all">Все категории</option>';
    
    const sortedCategories = [...categories].sort();
    
    sortedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
    
    categoryFilter.value = modalCategoryFilter;
}

// Получение выбранных категорий из формы
function getSelectedCategories() {
    const selectedCategories = [];
    document.querySelectorAll('.category-checkbox:checked').forEach(checkbox => {
        selectedCategories.push(checkbox.value);
    });
    return selectedCategories;
}

// Установка выбранных категорий в форме
function setSelectedCategories(categoriesArray) {
    // Сначала снимаем все выделения
    document.querySelectorAll('.category-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Затем устанавливаем выбранные категории
    if (categoriesArray && categoriesArray.length > 0) {
        categoriesArray.forEach(category => {
            const checkbox = document.querySelector(`.category-checkbox[value="${category}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
    }
}

// Добавление новой категории
async function addCategory() {
    const categoryNameInput = document.getElementById('new-category-name');
    if (!categoryNameInput) return;
    
    const categoryName = categoryNameInput.value.trim();
    
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
    
    categoryNameInput.value = '';
    renderCategoriesManagement();
    updateCategoriesSelect();
    updateModalCategoryFilter();
    renderCategoryList();
}

// Удаление категории
async function deleteCategory(categoryName) {
    if (!confirm(`Удалить категорию "${categoryName}"? Блюда в этой категории будут удалены из нее.`)) {
        return;
    }
    
    // Удаляем категорию из всех блюд
    dishes.forEach(dish => {
        if (dish.categories && dish.categories.includes(categoryName)) {
            dish.categories = dish.categories.filter(cat => cat !== categoryName);
        }
    });
    
    // Удаляем категорию из списка
    categories = categories.filter(cat => cat !== categoryName);
    
    await saveToGist();
    
    renderCategoriesManagement();
    updateCategoriesSelect();
    updateModalCategoryFilter();
    renderCategoryList();
    renderDishList();
}

// ==================== ОСНОВНЫЕ ФУНКЦИИ ====================

// Рендеринг планировщика на неделю
function renderWeekPlanner() {
    const weekPlanner = document.getElementById('week-planner');
    if (!weekPlanner) return;
    
    weekPlanner.innerHTML = '';
    
    const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    
    days.forEach(day => {
        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        
        const dayTitle = document.createElement('h3');
        dayTitle.textContent = day;
        dayCard.appendChild(dayTitle);
        
        // Контейнер для слотов приемов пищи
        const mealSlotsContainer = document.createElement('div');
        mealSlotsContainer.className = 'meal-slots-container';
        
        // Создаем слоты для приемов пищи
        const dayMealsCount = mealsPerDay[day] || 3;
        for (let i = 1; i <= dayMealsCount; i++) {
            const mealSlot = document.createElement('div');
            mealSlot.className = 'meal-slot';
            mealSlot.setAttribute('data-day', day);
            mealSlot.setAttribute('data-meal', i);
            
            const mealKey = `${day}-${i}`;
            const dish = weekPlan[mealKey];
            
            // Добавляем номер приема пищи (поверх картинки в левом верхнем углу)
            const mealNumber = document.createElement('div');
            mealNumber.className = 'meal-number';
            mealNumber.textContent = i;
            mealSlot.appendChild(mealNumber);
            
            if (dish) {
                let imageHtml = '';
                if (dish.image) {
                    imageHtml = `<img src="${dish.image}" alt="${dish.name}" class="dish-image">`;
                }
                
                mealSlot.innerHTML += `
                    ${imageHtml}
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
                mealSlot.innerHTML += 'Добавить блюдо';
            }
            
            mealSlot.addEventListener('click', function() {
                currentMealSlot = {
                    day: day,
                    meal: i
                };
                openDishSelectModal();
            });
            
            mealSlotsContainer.appendChild(mealSlot);
        }
        
        dayCard.appendChild(mealSlotsContainer);
        
        // Добавляем кнопки управления количеством приемов пищи
        const mealsControls = document.createElement('div');
        mealsControls.className = 'day-meals-controls';
        
        const minusBtn = document.createElement('button');
        minusBtn.className = 'btn btn-small btn-danger';
        minusBtn.textContent = '-';
        minusBtn.type = 'button';
        minusBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            changeDayMealsCount(day, -1);
        });
        
        const mealsCount = document.createElement('span');
        mealsCount.className = 'meals-count';
        mealsCount.textContent = dayMealsCount;
        
        const plusBtn = document.createElement('button');
        plusBtn.className = 'btn btn-small';
        plusBtn.textContent = '+';
        plusBtn.type = 'button';
        plusBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            changeDayMealsCount(day, 1);
        });
        
        mealsControls.appendChild(minusBtn);
        mealsControls.appendChild(mealsCount);
        mealsControls.appendChild(plusBtn);
        
        dayCard.appendChild(mealsControls);
        weekPlanner.appendChild(dayCard);
    });
    
    updateWeekSummary();
    updateShoppingList();
}

// Изменение количества приемов пищи для дня
async function changeDayMealsCount(day, change) {
    const currentCount = mealsPerDay[day] || 3;
    const newCount = currentCount + change;
    
    if (newCount < 1 || newCount > 10) {
        return;
    }
    
    // Обновляем данные
    mealsPerDay[day] = newCount;
    
    // Удаляем блюда, которые выходят за пределы нового количества приемов пищи
    Object.keys(weekPlan).forEach(mealKey => {
        const [mealDay, mealNumber] = mealKey.split('-');
        if (mealDay === day && parseInt(mealNumber) > newCount) {
            delete weekPlan[mealKey];
        }
    });
    
    try {
        // Сначала обновляем интерфейс
        renderWeekPlanner();
        
        // Затем сохраняем на сервер
        await saveToGist();
    } catch (error) {
        console.error('Ошибка при изменении количества приемов пищи:', error);
    }
}

// Рендеринг списка блюд с фильтрацией по категориям и поиском
function renderDishList() {
    const dishList = document.getElementById('dish-list');
    if (!dishList) return;
    
    dishList.innerHTML = '';
    
    let filteredDishes = dishes;
    
    // Фильтрация по категории
    if (currentCategory !== 'all') {
        filteredDishes = filteredDishes.filter(dish => 
            dish.categories && dish.categories.includes(currentCategory)
        );
    }
    
    // Фильтрация по поисковому запросу
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredDishes = filteredDishes.filter(dish => 
            dish.name.toLowerCase().includes(query)
        );
    }
    
    if (filteredDishes.length === 0) {
        let message = 'У вас пока нет сохраненных блюд. Добавьте первое блюдо!';
        if (currentCategory !== 'all' || searchQuery) {
            message = 'Блюда по вашему запросу не найдены.';
            if (currentCategory !== 'all' && searchQuery) {
                message = `В категории "${currentCategory}" нет блюд, содержащих "${searchQuery}" в названии.`;
            } else if (currentCategory !== 'all') {
                message = `В категории "${currentCategory}" пока нет блюд.`;
            } else if (searchQuery) {
                message = `Блюда, содержащие "${searchQuery}" в названии, не найдены.`;
            }
        }
        dishList.innerHTML = `<p>${message}</p>`;
        return;
    }
    
    filteredDishes.forEach((dish, index) => {
        const dishCard = document.createElement('div');
        dishCard.className = 'dish-card';
        
        let imageHtml = '';
        if (dish.image) {
            imageHtml = `<img src="${dish.image}" alt="${dish.name}" class="dish-image">`;
        }
        
        let categoriesHtml = '';
        if (dish.categories && dish.categories.length > 0) {
            categoriesHtml = dish.categories.map(cat => 
                `<span class="dish-category-badge">${cat}</span>`
            ).join('');
        }
        
        dishCard.innerHTML = `
            ${imageHtml}
            <h3>${dish.name}</h3>
            <div class="dish-categories">${categoriesHtml}</div>
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
    if (!shoppingListContainer) return;
    
    shoppingListContainer.innerHTML = '';
    
    const currentWeekKey = `current-week`;
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
        
        shoppingListContainer.appendChild(shoppingItem);
    });
}

// Назначение блюда на слот
async function assignDishToSlot(dishIndex) {
    if (!currentMealSlot) return;
    
    const mealKey = `${currentMealSlot.day}-${currentMealSlot.meal}`;
    weekPlan[mealKey] = dishes[dishIndex];
    
    await saveToGist();
    renderWeekPlanner();
}

// Очистка недели
async function clearWeek() {
    if (!confirm('Очистить всю неделю? Все назначенные блюда будут удалены из плана.')) {
        return;
    }
    
    weekPlan = {};
    await saveToGist();
    renderWeekPlanner();
}

// Открытие модального окна выбора блюда
function openDishSelectModal() {
    const modal = document.getElementById('dish-select-modal');
    if (!modal) return;
    
    // Сбрасываем фильтры при открытии
    modalSearchQuery = '';
    modalCategoryFilter = 'all';
    
    const modalSearchInput = document.getElementById('modal-dish-search');
    const modalCategoryFilterSelect = document.getElementById('modal-category-filter');
    
    if (modalSearchInput) modalSearchInput.value = '';
    if (modalCategoryFilterSelect) modalCategoryFilterSelect.value = 'all';
    
    updateModalCategoryFilter();
    renderModalDishList();
    
    modal.classList.add('active');
}

// Рендеринг списка блюд в модальном окне с фильтрацией
function renderModalDishList() {
    const dishList = document.getElementById('modal-dish-list');
    if (!dishList) return;
    
    dishList.innerHTML = '';
    
    let filteredDishes = dishes;
    
    // Фильтрация по категории
    if (modalCategoryFilter !== 'all') {
        filteredDishes = filteredDishes.filter(dish => 
            dish.categories && dish.categories.includes(modalCategoryFilter)
        );
    }
    
    // Фильтрация по поисковому запросу
    if (modalSearchQuery) {
        const query = modalSearchQuery.toLowerCase();
        filteredDishes = filteredDishes.filter(dish => 
            dish.name.toLowerCase().includes(query)
        );
    }
    
    if (filteredDishes.length === 0) {
        let message = 'У вас пока нет сохраненных блюд. Добавьте первое блюдо!';
        if (modalCategoryFilter !== 'all' || modalSearchQuery) {
            message = 'Блюда по вашему запросу не найдены.';
        }
        dishList.innerHTML = `<p>${message}</p>`;
        return;
    }
    
    filteredDishes.forEach((dish, index) => {
        const dishCard = document.createElement('div');
        dishCard.className = 'dish-card';
        
        let imageHtml = '';
        if (dish.image) {
            imageHtml = `<img src="${dish.image}" alt="${dish.name}" class="dish-image">`;
        }
        
        let categoriesHtml = '';
        if (dish.categories && dish.categories.length > 0) {
            categoriesHtml = dish.categories.map(cat => 
                `<span class="dish-category-badge">${cat}</span>`
            ).join('');
        }
        
        dishCard.innerHTML = `
            ${imageHtml}
            <h3>${dish.name}</h3>
            <div class="dish-categories">${categoriesHtml}</div>
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
            const modal = document.getElementById('dish-select-modal');
            if (modal) modal.classList.remove('active');
        });
        
        dishList.appendChild(dishCard);
    });
}

// Открытие модального окна рецепта
function openRecipeModal(dishIndex) {
    const modal = document.getElementById('recipe-modal');
    if (!modal) return;
    
    const dish = dishes[dishIndex];
    
    const recipeDishName = document.getElementById('recipe-dish-name');
    const recipeContent = document.getElementById('recipe-content');
    const recipeActions = document.getElementById('recipe-actions');
    
    if (!recipeDishName || !recipeContent || !recipeActions) return;
    
    recipeDishName.textContent = dish.name;
    
    let imageHtml = '';
    if (dish.image) {
        imageHtml = `<img src="${dish.image}" alt="${dish.name}" class="recipe-image">`;
    }
    
    let categoriesHtml = '';
    if (dish.categories && dish.categories.length > 0) {
        categoriesHtml = `<p><strong>Категории:</strong> ${dish.categories.join(', ')}</p>`;
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
    
    recipeContent.innerHTML = `
        ${imageHtml}
        <div class="recipe-section">
            ${categoriesHtml}
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
    
    recipeActions.innerHTML = `
        <button class="btn" id="edit-recipe-btn" data-index="${dishIndex}">Редактировать рецепт</button>
        <button class="btn btn-danger" id="delete-recipe-btn" data-index="${dishIndex}">Удалить рецепт</button>
    `;
    
    const editRecipeBtn = document.getElementById('edit-recipe-btn');
    const deleteRecipeBtn = document.getElementById('delete-recipe-btn');
    
    if (editRecipeBtn) {
        editRecipeBtn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            editDish(index);
            modal.classList.remove('active');
        });
    }
    
    if (deleteRecipeBtn) {
        deleteRecipeBtn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            showDeleteConfirmation(index);
        });
    }
    
    modal.classList.add('active');
}

// Показать подтверждение удаления
function showDeleteConfirmation(index) {
    const modal = document.getElementById('confirmation-modal');
    const confirmationMessage = document.getElementById('confirmation-message');
    
    if (!modal || !confirmationMessage) return;
    
    const dish = dishes[index];
    confirmationMessage.textContent = 
        `Вы уверены, что хотите удалить рецепт "${dish.name}"?`;
    dishToDelete = index;
    modal.classList.add('active');
}

// Редактирование блюда
function editDish(index) {
    const dish = dishes[index];
    
    const dishFormTitle = document.getElementById('dish-form-title');
    const editDishIndex = document.getElementById('edit-dish-index');
    const dishName = document.getElementById('dish-name');
    const dishDescription = document.getElementById('dish-description');
    const dishCalories = document.getElementById('dish-calories');
    const dishProtein = document.getElementById('dish-protein');
    const dishFat = document.getElementById('dish-fat');
    const dishCarbs = document.getElementById('dish-carbs');
    const imagePreview = document.getElementById('image-preview');
    const cancelEdit = document.getElementById('cancel-edit');
    const saveDishBtn = document.getElementById('save-dish-btn');
    
    if (!dishFormTitle || !editDishIndex || !dishName || !dishDescription || 
        !dishCalories || !dishProtein || !dishFat || !dishCarbs || 
        !imagePreview || !cancelEdit || !saveDishBtn) return;
    
    dishFormTitle.textContent = 'Редактировать блюдо';
    editDishIndex.value = index;
    dishName.value = dish.name;
    dishDescription.value = dish.description || '';
    dishCalories.value = dish.calories;
    dishProtein.value = dish.protein;
    dishFat.value = dish.fat;
    dishCarbs.value = dish.carbs;
    
    if (dish.image) {
        imagePreview.innerHTML = `<img src="${dish.image}" alt="Preview">`;
    } else {
        imagePreview.innerHTML = 'Превью изображения';
    }
    
    // Устанавливаем выбранные категории
    setSelectedCategories(dish.categories || []);
    
    const ingredientList = document.getElementById('ingredient-list');
    const stepList = document.getElementById('step-list');
    
    if (ingredientList) {
        ingredientList.innerHTML = '';
        if (dish.ingredients && dish.ingredients.length > 0) {
            dish.ingredients.forEach(ingredient => {
                addIngredientField(ingredient.name, ingredient.amount, ingredient.unit);
            });
        } else {
            addIngredientField();
        }
    }
    
    if (stepList) {
        stepList.innerHTML = '';
        if (dish.steps && dish.steps.length > 0) {
            dish.steps.forEach(step => {
                addStepField(step);
            });
        } else {
            addStepField();
        }
    }
    
    cancelEdit.style.display = 'inline-block';
    saveDishBtn.textContent = 'Обновить блюдо';
    
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    
    const addDishLink = document.querySelector('[data-section="add-dish"]');
    const addDishSection = document.getElementById('add-dish');
    
    if (addDishLink) addDishLink.classList.add('active');
    if (addDishSection) addDishSection.classList.add('active');
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
}

// Завершение сохранения блюда
async function completeSaveDish(name, categories, description, calories, protein, fat, carbs, imageBase64, editIndex) {
    const ingredients = [];
    document.querySelectorAll('.ingredient-item').forEach(item => {
        const name = item.querySelector('.ingredient-name')?.value;
        const amount = item.querySelector('.ingredient-amount')?.value;
        const unit = item.querySelector('.ingredient-unit')?.value;
        
        if (name && amount) {
            ingredients.push({ name, amount, unit });
        }
    });
    
    const steps = [];
    document.querySelectorAll('.step-item').forEach(item => {
        const description = item.querySelector('.step-description')?.value;
        
        if (description) {
            steps.push(description);
        }
    });
    
    const dishData = {
        name,
        categories,
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
}

// Сброс формы блюда
function resetDishForm() {
    const dishForm = document.getElementById('dish-form');
    const dishFormTitle = document.getElementById('dish-form-title');
    const editDishIndex = document.getElementById('edit-dish-index');
    const ingredientList = document.getElementById('ingredient-list');
    const stepList = document.getElementById('step-list');
    const imagePreview = document.getElementById('image-preview');
    const cancelEdit = document.getElementById('cancel-edit');
    const saveDishBtn = document.getElementById('save-dish-btn');
    
    if (dishForm) dishForm.reset();
    if (dishFormTitle) dishFormTitle.textContent = 'Добавить новое блюдо';
    if (editDishIndex) editDishIndex.value = '-1';
    if (ingredientList) ingredientList.innerHTML = '';
    if (stepList) stepList.innerHTML = '';
    if (imagePreview) imagePreview.innerHTML = 'Превью изображения';
    if (cancelEdit) cancelEdit.style.display = 'none';
    if (saveDishBtn) saveDishBtn.textContent = 'Сохранить блюдо';
    
    // Сбрасываем выбор категорий
    setSelectedCategories([]);
    
    addIngredientField();
    addStepField();
}

// Добавление поля ингредиента
function addIngredientField(name = '', amount = '', unit = 'г') {
    const ingredientList = document.getElementById('ingredient-list');
    if (!ingredientList) return;
    
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
    if (!stepList) return;
    
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
    
    const weeklyCalories = document.getElementById('weekly-calories');
    const weeklyProtein = document.getElementById('weekly-protein');
    const weeklyFat = document.getElementById('weekly-fat');
    const weeklyCarbs = document.getElementById('weekly-carbs');
    
    if (weeklyCalories) weeklyCalories.textContent = totalCalories;
    if (weeklyProtein) weeklyProtein.textContent = totalProtein.toFixed(1);
    if (weeklyFat) weeklyFat.textContent = totalFat.toFixed(1);
    if (weeklyCarbs) weeklyCarbs.textContent = totalCarbs.toFixed(1);
}

// Обновление списка покупок
async function updateShoppingList() {
    const currentWeekKey = `current-week`;
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

// Экспорт данных
function exportData() {
    const data = {
        dishes,
        weekPlan,
        shoppingList,
        categories,
        mealsPerDay,
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
            mealsPerDay = data.mealsPerDay || {
                'Понедельник': 3,
                'Вторник': 3,
                'Среда': 3,
                'Четверг': 3,
                'Пятница': 3,
                'Суббота': 3,
                'Воскресенье': 3
            };
            
            await saveToGist();
            
            renderWeekPlanner();
            renderCategoryList();
            renderDishList();
            renderCategoriesManagement();
            updateCategoriesSelect();
            updateModalCategoryFilter();
            renderShoppingList();
            updateWeekSummary();
            
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
    console.log('Настройка обработчиков событий...');
    
    // Очистка недели
    const clearWeekBtn = document.getElementById('clear-week');
    if (clearWeekBtn) {
        clearWeekBtn.addEventListener('click', clearWeek);
    }
    
    // Поиск в разделе "Мои блюда"
    const dishSearch = document.getElementById('dish-search');
    if (dishSearch) {
        dishSearch.addEventListener('input', function(e) {
            searchQuery = e.target.value;
            renderDishList();
        });
    }
    
    // Поиск и фильтрация в модальном окне
    const modalDishSearch = document.getElementById('modal-dish-search');
    if (modalDishSearch) {
        modalDishSearch.addEventListener('input', function(e) {
            modalSearchQuery = e.target.value;
            renderModalDishList();
        });
    }
    
    const modalCategoryFilter = document.getElementById('modal-category-filter');
    if (modalCategoryFilter) {
        modalCategoryFilter.addEventListener('change', function(e) {
            modalCategoryFilter = e.target.value;
            renderModalDishList();
        });
    }
    
    // Форма блюда
    const dishForm = document.getElementById('dish-form');
    if (dishForm) {
        dishForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveDish();
        });
    }
    
    const cancelEdit = document.getElementById('cancel-edit');
    if (cancelEdit) {
        cancelEdit.addEventListener('click', resetDishForm);
    }
    
    const dishImage = document.getElementById('dish-image');
    if (dishImage) {
        dishImage.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imagePreview = document.getElementById('image-preview');
                    if (imagePreview) imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    const addIngredientBtn = document.getElementById('add-ingredient');
    if (addIngredientBtn) {
        addIngredientBtn.addEventListener('click', function() {
            addIngredientField();
        });
    }
    
    const addStepBtn = document.getElementById('add-step');
    if (addStepBtn) {
        addStepBtn.addEventListener('click', function() {
            addStepField();
        });
    }
    
    // Категории
    const addCategoryBtn = document.getElementById('add-category');
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', addCategory);
    }
    
    // Синхронизация
    const setupSyncBtn = document.getElementById('setup-sync');
    if (setupSyncBtn) {
        setupSyncBtn.addEventListener('click', function() {
            const syncConfig = document.getElementById('sync-config');
            if (syncConfig) syncConfig.style.display = 'block';
        });
    }
    
    const saveSyncConfigBtn = document.getElementById('save-sync-config');
    if (saveSyncConfigBtn) {
        saveSyncConfigBtn.addEventListener('click', async function() {
            const githubToken = document.getElementById('github-token');
            const gistId = document.getElementById('gist-id');
            
            if (!githubToken || !gistId) return;
            
            const token = githubToken.value;
            const gistIdValue = gistId.value;
            
            if (!token) {
                alert('Введите GitHub Personal Access Token');
                return;
            }
            
            syncConfig.token = token;
            if (gistIdValue) syncConfig.gistId = gistIdValue;
            
            localStorage.setItem('syncConfig', JSON.stringify(syncConfig));
            updateSyncUI();
            
            await loadFromGist();
        });
    }
    
    const manualSyncBtn = document.getElementById('manual-sync');
    if (manualSyncBtn) {
        manualSyncBtn.addEventListener('click', forceSync);
    }
    
    const exportDataBtn = document.getElementById('export-data');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', exportData);
    }
    
    const importDataBtn = document.getElementById('import-data');
    if (importDataBtn) {
        importDataBtn.addEventListener('click', function() {
            const importFile = document.getElementById('import-file');
            if (importFile) importFile.click();
        });
    }
    
    const disableSyncBtn = document.getElementById('disable-sync');
    if (disableSyncBtn) {
        disableSyncBtn.addEventListener('click', function() {
            if (confirm('Отключить синхронизацию? Все данные будут потеряны!')) {
                syncConfig = {};
                localStorage.removeItem('syncConfig');
                dishes = [];
                weekPlan = {};
                shoppingList = {};
                categories = ['Завтраки', 'Обеды', 'Ужины', 'Десерты', 'Салаты'];
                mealsPerDay = {
                    'Понедельник': 3,
                    'Вторник': 3,
                    'Среда': 3,
                    'Четверг': 3,
                    'Пятница': 3,
                    'Суббота': 3,
                    'Воскресенье': 3
                };
                updateSyncUI();
                renderWeekPlanner();
                renderCategoryList();
                renderDishList();
                renderCategoriesManagement();
                updateCategoriesSelect();
                updateModalCategoryFilter();
                renderShoppingList();
                updateWeekSummary();
            }
        });
    }
    
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
    
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function() {
            if (dishToDelete !== null) {
                deleteDish(dishToDelete);
                const confirmationModal = document.getElementById('confirmation-modal');
                if (confirmationModal) confirmationModal.classList.remove('active');
                dishToDelete = null;
            }
        });
    }
    
    const cancelDeleteBtn = document.getElementById('cancel-delete');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', function() {
            const confirmationModal = document.getElementById('confirmation-modal');
            if (confirmationModal) confirmationModal.classList.remove('active');
            dishToDelete = null;
        });
    }
    
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.json';
    importInput.id = 'import-file';
    importInput.style.display = 'none';
    importInput.addEventListener('change', importData);
    document.body.appendChild(importInput);
    
    console.log('Обработчики событий настроены');
}

// Инициализация пустых полей при загрузке
addIngredientField();
addStepField();