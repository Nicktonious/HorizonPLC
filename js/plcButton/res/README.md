<div style = "font-family: 'Open Sans', sans-serif; font-size: 16px">

# ModuleButton

<div style = "color: #555">
    <p align="center">
    <img src="logo.png" width="400" title="hover text">
    </p>
</div>

## Лицензия

<div style = "color: #555">
В разработке
</div>

## Описание
<div style = "color: #555">

Модуль предназначен для работы с цифровыми кнопками в рамках фреймворка Horizon Automated. Обеспечивает мониторинг состояния кнопки и её основные события. Модуль разработан в соответствии с нотацией архитектуры датчиков и является потомком класса [plcSensor](../../plcSensor/res/README.md). Взаимодействие осуществляется через 0-й канал. 

Функционал данного модуля позволяет применять кнопки в различных сценариях. При этом рекомендуем также ознакомиться с модулем [бистабильной кнопки](../../plcBistableButton/res/README_BISTABLE.md) которая будут более удобна в некоторых сценариях. 

</div>

## Конструктор
<div style = "color: #555">

Конструктор принимает данные из конфига. Пример ниже:
```json
"btn": {
    "pins": ["A3"],
    "debounce": 50,
    "name": "Button",
    "article": "",
    "type": "sensor",
    "channelNames": ["press"],
    "quantityChannel": 1,
    "modules": ["plcButton.min.js"]
}
```
</div>

### Поля
<div style = "color: #555">

- <mark style="background-color: lightblue">_Debounce</mark> - время в мс, которое программа ждет утихания дребезга на пине;
- <mark style="background-color: lightblue">_HoldTime</mark> - время в секундах, необходимое для срабатывания события 'hold';на кнопке;
- <mark style="background-color: lightblue">_Interval</mark> - функция SetInterval для опроса кнопки.
</div>

### Методы
<div style = "color: #555">

- <mark style="background-color: lightblue">Start(_chNum)</mark> - запускает мониторинг состояния кнопки;
- <mark style="background-color: lightblue">Stop(_chNum)</mark> - прекращает запускает мониторинг состояния кнопки;
- <mark style="background-color: lightblue">OnSetWatch(_interruptState)</mark> - обработчик прерываний;
</div>

### События
<div style = "color: #555">

- <mark style="background-color: lightblue">press</mark> - нажатие кнопки;
- <mark style="background-color: lightblue">release</mark> - кнопка отпущена;
- <mark style="background-color: lightblue">click</mark> - собственно клик;
- <mark style="background-color: lightblue">hold</mark> - удержание;

В событии возвращается объект-состояние прерывания.
</div>

### Возвращаемые данные
<div style = "color: #555">
Как датчик модуль предоставляет данные о состоянии кнопки: 0-вкл, 1-выкл.
</div>

### Примеры
#### События press и click
<div style = "color: #555">

```js
let btn = H.DeviceManager.Service.CreateDevice('btn')[0];
btn.Start();

let t1;
btn.on('press', (e) => {
    print('pressed');
});

btn.on('click', (e) => {
    print(`released after ${(e.time-e.lastTime).toFixed(2)}`);
});
// Теперь несколько раз зажмем кнопку на какое то время
```

Результат выполнения:
<div align='left'>
    <img src='./example-1.png'>
</div>

#### Событие hold 
```js
let btn = H.DeviceManager.Service.CreateDevice('btn')[0];
// Опциональная настройка времени (в сек.) за которое срабатывает удержание
btn.Configure({ holdTime: 0.3 });
btn.Start();

btn.on('hold',  () => { print('hold'); });
//Теперь несколько раз зажмем кнопку
```

Результат выполнения:
<div align='left'>
    <img src='./example-2.png'>
</div>

</div>

### Зависимости
<div style = "color: #555">

</div>

- <mark style="background-color: lightblue">[plcSensor](../../plcSensor/res/README.md)</mark>
- <mark style="background-color: lightblue">[plcAppError](../../plcAppError/res/README.md)</mark>
</div>
