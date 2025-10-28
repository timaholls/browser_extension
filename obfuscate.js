const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

// Базовая конфигурация обфускации + профили для разных файлов
const baseObfuscationOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 1.0,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.6,
    debugProtection: true,
    debugProtectionInterval: 3000,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'mangled',
    identifiersPrefix: '_' + Math.random().toString(36).slice(2, 10),
    log: false,
    numbersToExpressions: true,
    renameGlobals: true,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 3,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['rc4', 'base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 5,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 6,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 1.0,
    transformObjectKeys: true,
    unicodeEscapeSequence: true,
    target: 'browser',
    sourceMap: false,
    // Резервируем системные идентификаторы/строки Chrome, чтобы не сломать API
    reservedNames: ['chrome', 'self', 'importScripts', 'addEventListener', 'removeEventListener', 'onmessage', 'postMessage'],
    reservedStrings: ['chrome.runtime', 'chrome.proxy', 'chrome.storage', 'chrome.webRequest']
};

// Профиль для service worker (осторожнее с selfDefending/debugProtection)
const swObfuscationOptions = {
    ...baseObfuscationOptions,
    // Некоторые анти-отладочные механизмы могут конфликтовать с MV3 service worker
    debugProtection: false,
    debugProtectionInterval: 0,
    selfDefending: false,
    disableConsoleOutput: false,
};

// Профиль для UI (popup) — максимально агрессивный
const uiObfuscationOptions = {
    ...baseObfuscationOptions
};

// Функция для обфускации файла
function obfuscateFile(inputPath, outputPath, options) {
    try {
        console.log(`Обфускация файла: ${inputPath}`);
        
        const sourceCode = fs.readFileSync(inputPath, 'utf8');
        const obfuscatedCode = JavaScriptObfuscator.obfuscate(sourceCode, options || baseObfuscationOptions);
        
        // Создаем директорию если не существует
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, obfuscatedCode.getObfuscatedCode());
        console.log(`✅ Обфусцированный файл сохранен: ${outputPath}`);
        
    } catch (error) {
        console.error(`❌ Ошибка обфускации ${inputPath}:`, error.message);
    }
}

// Функция для минификации JSON
function minifyJson(inputPath, outputPath) {
    try {
        console.log(`Минификация JSON: ${inputPath}`);
        
        const jsonContent = fs.readFileSync(inputPath, 'utf8');
        const parsed = JSON.parse(jsonContent);
        const minified = JSON.stringify(parsed);
        
        fs.writeFileSync(outputPath, minified);
        console.log(`✅ Минифицированный JSON сохранен: ${outputPath}`);
        
    } catch (error) {
        console.error(`❌ Ошибка минификации JSON ${inputPath}:`, error.message);
    }
}

// Функция для минификации HTML
function minifyHtml(inputPath, outputPath) {
    try {
        console.log(`Минификация HTML: ${inputPath}`);
        
        let htmlContent = fs.readFileSync(inputPath, 'utf8');
        
        // Простая минификация HTML
        htmlContent = htmlContent
            .replace(/\s+/g, ' ')  // Заменяем множественные пробелы на один
            .replace(/>\s+</g, '><')  // Убираем пробелы между тегами
            .trim();
        
        fs.writeFileSync(outputPath, htmlContent);
        console.log(`✅ Минифицированный HTML сохранен: ${outputPath}`);
        
    } catch (error) {
        console.error(`❌ Ошибка минификации HTML ${inputPath}:`, error.message);
    }
}

// Создаем папку для обфусцированных файлов
const outputDir = path.join(__dirname, 'extensions_obfuscated');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log('🚀 Начинаем обфускацию браузерного расширения...\n');

// Обфусцируем JavaScript файлы
obfuscateFile(
    path.join(__dirname, 'extensions', 'background_direct_new.js'),
    path.join(outputDir, 'background_direct_new.js'),
    swObfuscationOptions
);

obfuscateFile(
    path.join(__dirname, 'extensions', 'popup.js'),
    path.join(outputDir, 'popup.js'),
    uiObfuscationOptions
);

// Минифицируем JSON файлы
minifyJson(
    path.join(__dirname, 'extensions', 'manifest.json'),
    path.join(outputDir, 'manifest.json')
);

// Минифицируем HTML файлы
minifyHtml(
    path.join(__dirname, 'extensions', 'popup.html'),
    path.join(outputDir, 'popup.html')
);

// Копируем иконки
const iconsDir = path.join(outputDir, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

try {
    fs.copyFileSync(
        path.join(__dirname, 'extensions', 'icons', 'icon.svg'),
        path.join(iconsDir, 'icon.svg')
    );
    console.log('✅ Иконка скопирована');
} catch (error) {
    console.error('❌ Ошибка копирования иконки:', error.message);
}

console.log('\n🎉 Обфускация завершена!');
console.log(`📁 Обфусцированные файлы сохранены в: ${outputDir}`);
console.log('\n📋 Структура обфусцированного расширения:');
console.log('extensions_obfuscated/');
console.log('├── background_direct_new.js (обфусцированный + встроенная конфигурация)');
console.log('├── popup.js (обфусцированный)');
console.log('├── popup.html (минифицированный)');
console.log('├── manifest.json (минифицированный)');
console.log('└── icons/');
console.log('    └── icon.svg');
