<div style = "font-family: 'Open Sans', sans-serif; font-size: 16px">

# ModuleTimeoutButton

<div style = "color: #555">
    <p align="center">
    <img src="./res/logo.png" width="400" title="hover text">
    </p>
</div>

## Лицензия

<div style = "color: #555">
В разработке
</div>

## Описание
<div style = "color: #555">

Модуль фреймворка Horizon Automated, предназначенный для работы с цифровыми кнопками, работающими по таймауту. Модуль разработан в соответствии с нотацией архитектуры датчиков и является потомком класса [ClassSensor](https://github.com/Konkery/ModuleSensorArchitecture/blob/main/README.md). Взаимодействие осуществляется через 0-й канал. 

Как следует из названия, данная кнопка переходит в статус "вкл" при нажатии, и возвращается в статус "выкл" через заданное время.

В контексте Horizon Automated бистабильная кнопка является гибридом, в котором основное устройство - датчик. Поэтому использование данного модуля предусматривается только с применением цветовой индикации (кнопки со светодиодом).

</div>

## Конструктор
<div style = "color: #555">

Конструктор принимает данные из конфига. Пример ниже:
```json
"17": {
    "pins": ["P11"],
    "name": "DigitalLed",
    "article": "",
    "type": "actuator",
    "channelNames": ["light"],
    "typeInSignals": ["digital"],
    "quantityChannel": 1,
    "busTypes": [],
    "manufacturingData": {},
    "modules": ["ModuleDigitalLed.min.js"]
},
"18": {
    "pins": ["A3"],
    "subDevice": ["25"],
    "timeout": 3,       // Значение в секундах
    "name": "TimeoutButton",
    "article": "",
    "type": "hybrid",   // Обратите внимание!
    "channelNames": ["press"],
    "typeInSignal": "analog",
    "typeOutSignal": "digital",
    "quantityChannel": 1,
    "busTypes": [],
    "manufacturingData": {},
    "modules": ["ModuleTimeoutButton.min.js"]
}
```
</div>

### Поля
<div style = "color: #555">

- <mark style="background-color: lightblue">_Led</mark> - ссылка на исполнительный канал Led индикатора на кнопке;
- <mark style="background-color: lightblue">_TimeoutDelay</mark> - время таймаута в секундах;
- <mark style="background-color: lightblue">_Debounce</mark> - "антидребезг" при мониторинге кнопки.

</div>

### Методы
<div style = "color: #555">

- <mark style="background-color: lightblue">Start()</mark> - запускает мониторинг состояния кнопки;
- <mark style="background-color: lightblue">Stop()</mark> - прекращает мониторинг состояния кнопки.
</div>

### События
<div style = "color: #555">

- <mark style="background-color: lightblue">enable</mark> - включение;
- <mark style="background-color: lightblue">disable</mark> - выключение;
- <mark style="background-color: lightblue">changeState</mark> - смена состояния;
</div>

### Возвращаемые данные
<div style = "color: #555">
Как датчик модуль предоставляет данные о состоянии кнопки: 0-вкл, 1-выкл.
</div>

### Примеры
#### События enable, disable, changeState
<div style = "color: #555">

```js
let btn = H.DeviceManager.Service.CreateDevice('25')[0];
btn.Start();

btn.on('enable', () => { print('on'); });
btn.on('disable', () => { print('off'); });
btn.on('changeState', () => { print('changeState'); });

// Теперь два раза кликнем по кнопке
```

Результат выполнения:

Обратите внимание на то, что событие **enable** выполняется при каждом нажатии кнопки, а **changeState** только когда статус действительно меняется.
<div align='left'>
    <img src='./res/example-4.png'>
</div>

</div>

### Зависимости
<div style = "color: #555">

</div>

</div>
