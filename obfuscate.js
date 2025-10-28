const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

// Конфигурация обфускации для service worker
const obfuscationOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false, // Отключаем для service worker
    debugProtectionInterval: 0,
    disableConsoleOutput: false, // Оставляем console для отладки
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false, // Отключаем для service worker
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 5,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false,
    // Дополнительные настройки для service worker
    target: 'browser',
    reservedNames: ['chrome', 'self', 'importScripts', 'addEventListener', 'removeEventListener'],
    reservedStrings: ['chrome.runtime', 'chrome.proxy', 'chrome.storage', 'chrome.webRequest']
};

// Функция для обфускации файла
function obfuscateFile(inputPath, outputPath) {
    try {
        console.log(`Обфускация файла: ${inputPath}`);
        
        const sourceCode = fs.readFileSync(inputPath, 'utf8');
        const obfuscatedCode = JavaScriptObfuscator.obfuscate(sourceCode, obfuscationOptions);
        
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
    path.join(outputDir, 'background_direct_new.js')
);

obfuscateFile(
    path.join(__dirname, 'extensions', 'popup.js'),
    path.join(outputDir, 'popup.js')
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
