<div style = "font-family: 'Open Sans', sans-serif; font-size: 16px">

# ClassBaseDevice
<div style = "color: #555">
    <p align="center">
    <img src="logo.png" width="400" title="hover text">
    </p>
</div>

## Описание
<div style = "color: #555">

Базовый класс в стеке [plcSensor](../../plcSensor/res/README.md) и [plcActuator](../../plcActuator/res/README.md). Является отправной точкой для создания объектов датчиков и актуаторов. Обеспечивает сбор и хранение информации о них. Его поля предоставляют основные характеристики, необходимых для идентификации и настройки устройства в рамках фреймворка Horizon Automated: переданные в его конструктор параметры и описательную характеристику. Перечень полей см. ниже.
</div>

### Конструктор
<div style = "color: #555">

Конструктор принимает объект типа **DeviceOptsType**, наполнение которого определяется конфигом. Единственный нюанс в том, что при получении данных из конфига, еще до вызова конструктора объекта устройства, строковое представление *bus* и *pins* преобразуется в js-объекты. 

Рассмотрим основной набор параметров на примере конфига к [VL6180](../../plcLightVL6180X/res/README.md). Детальное пояснение к параметрам описано [ниже](./README_ANCESTOR.md/#поля).


```json
"vl": {                 // ID устройства
    "bus": "I2C10",       
    "address": 41,      // обязательный параметр для модулей, работающих по I2C               
    "name": "VL6180",                       
    "article": "02-501-0105-201-0004",           
    "type": "sensor",              
    "channelNames": ["light", "range"],
    "modules": ["plcVL6180.min.js"]
}
```

Также *датчикам* можно передавать следующие свойства:
- <mark style="background-color: lightblue">repeatability</mark> - повторяемость;
- <mark style="background-color: lightblue">precision</mark> - точность;
- и различные специфичные для датчиков параметры; но важно учитывать, что их обработка уже сугубо в ответственности прикладного модуля.

</div>

### Поля
<div style = "color: #555">

- <mark style="background-color: lightblue">_Bus</mark> - используемая шина;
- <mark style="background-color: lightblue">_Pins</mark> - массив пинов, используемых устройством;
- <mark style="background-color: lightblue">_Address</mark> - адрес устройства на шине;
- <mark style="background-color: lightblue">_QuantityChannel</mark> - число каналов устройства, реализуемых модулем;
- <mark style="background-color: lightblue">_Id</mark> - идентификатор устройства;
- <mark style="background-color: lightblue">_Article</mark> - артикль устройства; необходим для идентификации устройства на верхнем уровне (на серверной стороне); 
- <mark style="background-color: lightblue">_Name</mark> - имя устройства;
- <mark style="background-color: lightblue">_Type</mark> - тип устройства: "sensor" | "actuator" | "hybrid". Пример гибрида - кнопка с LED-индикатором;
- <mark style="background-color: lightblue">_ChannelNames</mark> - массив с названиями каналов;
</div>

### Методы
<div style = "color: #555">

- <mark style="background-color: lightblue">CheckProps()</mark> - проверяет валидность некоторых полей устройства.
</div>

### Примеры
<div style = "color: #555">

Данный класс применяется исключительно как звено наследования и не используется независимо. Потому наследники обязаны иметь такие же параметры конструктора, который ввиду особенностей среды выполнения Espruino вызывается таким образом:
```js
ClassBaseDevice.call(this, _opts);
либо
ClassBaseDevice.apply(this, [_opts]);
```
</div>

# ClassDevice

## Описание
<div style = "color: #555">

Является ключевой составляющей модулей [Sensor](../../plcSensor/res/README.md) и [Actuator](../../plcActuator/res/README.md). Смысл данного класса заключается в унификации работы с устройствами и их каналами, обеспечивая легкость и надежность взаимодействия прикладных разработчиков с устройствами в рамках фреймворка Horizon Automated. Наследуется от [ClassBaseDevice](./README.md/#classbasedevice).
Реализует важнейшие принципы **ModuleSensor**:
- Автоматическое создание каналов: при инициализации "реального" датчика рассматриваемый класс автоматически создает [объекты-каналы](./README_CHANNEL.md), которые композируются в поле этого класса. Это упрощает создание и управление каналами датчика;
- Определение сигнатур методов: класс определяет сигнатуры основных методов, которые будут доступны для работы с "реальными" устройствами и их каналами. Это обеспечивает единый интерфейс для инициализации, запуска, настройки и управления устройствами.
</div>

### Поля
<div style = "color: #555">
- <mark style="background-color: lightblue">_Channels</mark> - массив с автоматически инстанцирующимися объектами ClassChannel.
</div>

### Аксессоры
<div style = "color: #555">

- <mark style="background-color: lightblue">ID</mark> - геттер, возвращающий id устройства.
- <mark style="background-color: lightblue">CountChannels</mark> - геттер, возвращающий количество корректно инициализированных каналов типа **ClassChannel**.
</div>

### Методы
<div style = "color: #555">

- <mark style="background-color: lightblue">GetChannel(_chNum)</mark> - возвращает объект i-го канала;
- <mark style="background-color: lightblue">Init(_opts)</mark> - обязывает провести инициализацию устройства настройкой необходимых для его работы регистров;
- <mark style="background-color: lightblue">Configure(_chNum, _opts)</mark> - обязывает выполнить дополнительную конфигурацию устройства. Это может быть настройка пина прерывания, периодов измерения и прочих шагов, которые в общем случае необходимы для работы устройства, но могут переопределяться в процессе работы, и потому вынесены из метода Init();
- <mark style="background-color: lightblue">Reset(_chNum, _opts)</mark> - обязывает выполнить перезагрузку устройства;
- <mark style="background-color: lightblue">Read(_reg)</mark> - обязывает выполнить чтение с регистра;
- <mark style="background-color: lightblue">Write(_reg, _val)</mark> - обязывает выполнить запись в регистр.
</div>

### Зависимости
<div style = "color: #555">

- <mark style="background-color: lightblue">[plcAppError](../../plcAppError/res/README.md)</mark>
</div>

</div>