<div style = "font-family: 'Open Sans', sans-serif; font-size: 16px">

# ModuleAirQualityCCS811
<div style = "color: #555">
    <p align="center">
    <img src="logo.png" width="400" title="hover text">
    </p>
</div>

# Лицензия
////

# Описание
<div style = "color: #555">

Модуль предназначен для работы с датчиком качества воздуха на базе чипа [CCS811](https://github.com/Konkery/ModuleAirQualityCCS811/blob/main/res/CCS811_Datasheet.pdf). Модуль является неотъемлемой частью фреймворка Horizon Automated. Датчик на баз чипа CCS811 позволяет получить данные о концентрации углекислого газа в воздухе в миллионных долях (ppm) и о концентрации летучих органических веществах в миллиардных долях (ppb). Во время работы датчик будет нагреваться, что является естественным для данного тпа газоанализаторов (MOX). Модуль работает по интерфейсу I2C. Модуль имеет следующие архитектурные решения фреймворка Horizon Automated:
- является потомком класса [ClassMiddleSensor](https://github.com/Konkery/ModuleSensorArchitecture/blob/main/README.md);
- создаёт шину через глобальный объект [I2Cbus](https://github.com/Konkery/ModuleBaseI2CBus/blob/main/README.md).

Количество каналов для снятия данных - 2.
</div>

### Конструктор
<div style = "color: #555">

Конструктор принимает 1 объект типа **SensorOptsType** и 1 объект типа [**SensorOptsType**](https://github.com/Konkery/ModuleSensorArchitecture/blob/main/README.md):
```js
let sensor_props = {
    name: "CCS811",
    type: "sensor",
    channelNames: ['eCO2', 'TOVC'],
    typeInSignal: "analog",
    typeOutSignal: "digital",
    quantityChannel: 2,
    busType: [ "i2c" ],
};
const _opts = {
    bus: i2c_bus,
    address: 0x5A,
    repeatability: 'LOW',
    mode: 1,
    temp: 24,
    hum: 45
}
```
- <mark style="background-color: lightblue">bus</mark> - объект класса I2C, возвращаемый диспетчером I2C шин - [I2Cbus](https://github.com/Konkery/ModuleBaseI2CBus/blob/main/README.md);
- <mark style="background-color: lightblue">address</mark> - адрес датчика на шине;
- <mark style="background-color: lightblue">repeatability</mark> - повторяемость датчика (см. документацию на датчик);
- <mark style="background-color: lightblue">mode</mark> - число от 0 до 4 - режим работы датчика (см. документацию на датчик);
- <mark style="background-color: lightblue">temp</mark> - значение температуры воздуха в градусах Цельсия, нужно для более точного расчёта данных, не является обязательным полем, использовать совместно с полем hum;
- <mark style="background-color: lightblue">hum</mark> - значение влажности воздуха в процентах, нужно для более точного расчёта данных, не является обязательным полем, использовать совместно с полем temp.
</div>

### Поля
<div style = "color: #555">

- <mark style="background-color: lightblue">_Name</mark> - имя класса в строковом виде;
- <mark style="background-color: lightblue">_Sensor</mark> - объект базового класса;
- <mark style="background-color: lightblue">_MinPeriod</mark> - минимальная частота опроса датчика - 250 мс;
- <mark style="background-color: lightblue">_UsedChannels</mark> - используемые каналы данных по нотации архитектуры фреймворка Horizon Automated;
- <mark style="background-color: lightblue">_Interval</mark> - функция SetInterval для опроса датчика;
- <mark style="background-color: lightblue">_Margin</mark> - объект, хранящий поля temp и hum - значения температуры и влажности воздуха, необходимы для более точного расчёта выходных данных;
- <mark style="background-color: lightblue">_CanRead</mark> - булевый флаг, разрешающий читать данные с датчика или наоборот запрещающий.
</div>

### Методы
<div style = "color: #555">

- <mark style="background-color: lightblue">Init(_sensor_props)</mark> - метод обязывающий провести инициализацию датчика. Если поле _Margin не undefined - запускает метод SetTempHumMargin();
- <mark style="background-color: lightblue">SetTempHumMargin(_margin)</mark> - записывает в определенные регистры датчика значения температуры и влажности воздуха для повышения точности расчётов выходных данных;
- <mark style="background-color: lightblue">Start(_num_channel, _period)</mark> - метод запускает циклический опрос определенного канала датчика с заданной периодичностью в мс. Переданное значение периода сверяется с минимальным значением, хранящимся в поле *_MinPeriod*, и, если требуется, регулируется;
- <mark style="background-color: lightblue">ConfigureRegs(_opts)</mark> - меняет режим работы датчика, на время перезапуска меняет флаг поля _CanRead на false;
- <mark style="background-color: lightblue">ChangeFreq(_num_channel, _period)</mark> - метод останавливает опрос указанного канала и запускает его вновь с уже новой частотой.
- <mark style="background-color: lightblue">Stop(_num_channel)</mark> - метод прекращает считывание значений с заданного канала.
</div>

### Возвращаемые данные
<div style = "color: #555">

Датчик предоставляет данные о концентрации углекислого газа в воздухе в миллионных долях (ppm), и о концентрации летучих органических веществ в миллиардных долях (ppb). Значения концентрации углекислого газа варьируются от 400ppm до 8192ppm, а для ЛОВ - от 0ppb до 1187ppb. Значения, выходящие за обозначенные отрезки приравниваются к максимальному/минимальному значению отрезка. Работая в режиме 4 датчик возвращает необработанные сырые данные о токах, проходящих через датчик - силу тока в микроамперах и текущее напряжение в вольтах.
</div>

### Примеры
<div style = "color: #555">

Фрагмент кода для вывода данных о давлении и температуре в консоль раз в одну секунду. Предполагается, что все необходимые модули уже загружены в систему:
```js
//Подключение необходимых модулей
const ClassI2CBus = require("ClassBaseI2CBus.min.js");
const err = require("ModuleAppError.min.js");
const NumIs = require("ModuleAppMath.min.js");
     NumIs.is(); //добавить функцию проверки целочисленных чисел в Number

//Создание I2C шины
let I2Cbus = new ClassI2CBus();
let bus = I2Cbus.AddBus({sda: B9, scl: B8, bitrate: 400000}).IDbus;

//Настройка передаваемых объектов
const gasClass = require('ClassAirQualityCCS811.min.js');
let opts = {pins: [P5, P6], bus: PrimaryI2C, address: 0x5A, mode: 1, quantityChannel: 2};
let sensor_props = {
    name: "CCS811",
    type: "sensor",
    channelNames: ['CO2', 'TVOC'],
    typeInSignal: "digital",
    typeOutSignal: "digital",
    quantityChannel: 2,
    busType: [ "i2c" ],
    manufacturingData: {
        IDManufacturing: [
            {
                "GasMeter": "A2224"
            }
        ],
        IDsupplier: [
            {
                "Sensory": "5522"
            }
        ],
        HelpSens: "CCS811 Air Quality"
    }
};
//Создание объекта класса
let gas = new gasClass(opts, sensor_props);

const ch0 = gas.GetChannel(0);
const ch1 = gas.GetChannel(1);

//Создание каналов
ch0.Start(1000);
ch1.Start(1000);

//Вывод данных
setInterval(() => {
  console.log(`CO2: ${(ch0.Value)} ppm    TVOC: ${(ch1.Value)} ppb`);
}, 1000);
```
Вывод данных в консоль:
<p align="left">
  <img src="./res/output.png" title="hover text">
</p>
<div>

# Зависимости
- [ClassBaseI2CBus](https://github.com/Konkery/ModuleBaseI2CBus/blob/main/README.md)
- [ModuleAppError](https://github.com/Konkery/ModuleAppError/blob/main/README.md)
- [ModuleAppMath](https://github.com/Konkery/ModuleAppMath/blob/main/README.md)


</div>