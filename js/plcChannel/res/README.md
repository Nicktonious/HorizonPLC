<div style = "font-family: 'Open Sans', sans-serif; font-size: 16px">

# ClassChannel
<div style = "color: #555">
    <p align="center">
    <img src="logo.png" width="400" title="hover text">
    </p>
</div>

### Описание
<div style = "color: #555">

Системный класс, который является предком каждого отдельно взятого канала датчика либо актутора. Класс хранит в себе ссылки на основной объект сенсора и "проброшенные" методы для работы с данным каналом устройства, являющиеся общими для датчиков и актуаторов. 
Также данный класс композирует в себе сервисные классы (см. [ClassDataRefine](./README_DATA_REFINE.md) и [ClassAlarms](./README_ALARMS.md)), которые безусловно используются в [аксессорах](./README_MIDDLE.md#аксессоры) [ClassChannelSensor](../../plcSensor/res/README_CHANNEL.md) и [ClassChannelActuator](../../plcActuator/res/README_CHANNEL.md) при обработке вх./вых. значений.
</div>

### Конфигурация каналов
<div style = "color: #555">
Пример полной конфигурации каналов для датчика VL6180:

```json
{
    "vl": {
        "bus": "I2C10",
        "name": "VL6180",
        "article": "02-501-0102-201-0004",
        "type": "sensor",
        "channelNames": [
            "light",
            "range"
        ],
        "channelsConfig": {
            "light": {
                "mqtt": {
                    "address": "/Horizon/PLC-vl-0"
                },
                "transform": {
                    "k": 1,
                    "b": 0
                },
                "suppression": {
                    "low": -100,
                    "high": 300
                },
                "buffer": {
                    "size": 5,
                    "filterName": "averageFilter"
                },
                "zones": {
                    "red": {
                        "low": -500,
                        "high": 500
                    },
                    "yellow": {
                        "low": -300,
                        "high": 300
                    }
                }
            },
            "range": {
                "address": "/Horizon/PLC-11-0",
                "transform": {
                    "transformFunc": "someTransfName" 
                }
            }
        },
        "modules": ["plcVL6180.min.js"]
    }
}
```
</div>

### Строковые каналы
<div style = "color: #555">

Если конфигурация канала содержит поле `valueType: "string"`, то поле `_IsNumType` приобретает значение `false`. При `this._IsNumType == false`, значение **Value** канала считывается или сохраняется напрямую, в обход математической обработки. 

</div>

### Поля
<div style = "color: #555">

- <mark style="background-color: lightblue">_Device</mark> - ссылка на основной объект датчика;
- <mark style="background-color: lightblue">_Value</mark> - поле, в которое сохраняется последнее считанное значение *Value* датчика либо заданное значение актуатора;
- <mark style="background-color: lightblue">_Bypass</mark> - флаг, при взведении которого вх. значения будут становиться результирующими в обход мат. обработки; позволяет сохранять в Value значения не числовых типов;
- <mark style="background-color: lightblue">_IsNumType</mark> - применяется ли числовая обработка данных в канале;
- <mark style="background-color: lightblue">_ChangeThreshold</mark> - порог изменения - процент, на который должно измениться Value чтобы SM считал его новым;
- <mark style="background-color: lightblue">_ChNum</mark> - номер канала;
- <mark style="background-color: lightblue">_Alarms</mark> - объект класса ClassAlarms;
- <mark style="background-color: lightblue">_Transform</mark> - объект класса ClassTransform;
- <mark style="background-color: lightblue">_Suppression</mark> - объект класса ClassSuppression;


</div>

### Аксессоры
<div style = "color: #555">

- <mark style="background-color: lightblue">Value</mark> - сеттер в который **необходимо** записывать полученные с датчика необработанные значения  и с него же далее необходимо их считывать. При считывании значения через геттер "сырое" значение автоматически проходит через все этапы математической обработки, включая проверку зон измерения (см. диаграмму "Обработка значений с датчика" ниже);

- <mark style="background-color: lightblue">Suppression</mark> - возвращает объект *ClassSuppression*;
- <mark style="background-color: lightblue">Transform</mark> - возвращает объект *ClassTransform*;
- <mark style="background-color: lightblue">Alarms</mark> - возвращает объект *ClassAlarms* после его инициализации;
- <mark style="background-color: lightblue">ID</mark> - возвращает идентификатор канала датчика;
- <mark style="background-color: lightblue">ChangeThreshold</mark> - процент, на который должно измениться показание с датчика, чтобы DeviceManager считал его обновившимся;
- <mark style="background-color: lightblue">Status</mark> - задает и возвращает текущий статус датчика (канала) в виде числового кода. 
    - 0 - канал не активен;
    - 1 - канал в работе;
    - 2 - датчик в переходном процессе

</div>

### Методы
<div style = "color: #555">

- <mark style="background-color: lightblue">EnableAlarms(_opts)</mark> - создает объект *_Alarms*;
- <mark style="background-color: lightblue">Configure(_chNum, _opts)</mark>
- <mark style="background-color: lightblue">GetInfo(_chNum)</mark>
- <mark style="background-color: lightblue">Reset()</mark>

Некоторые из этих методов ссылаются на соответствующий функционал, объявленный в **ClassSensor** и реализованный в прикладном классе датчика. Развернутое описание данных методов [по ссылке](./README_MIDDLE.md#методы).

### Обработка значений с датчика
<div style = "color: #555">

В рамках реализации модуля любого датчика, считанное с него значение сохраняется через сеттер *Value* класса **ClassChannelSensor** в *_ValueBuffer* (кольцевой буфер). 

Перед добавлением в буфер значение проходит через супрессию и преобразование либо через линейную функцию, либо через функцию, установленную пользователем. 

При считывании значения *Value*, буфер обрабатывается функцией-фильтром, результат которой и возвращается пользователю. 

Если ранее был вызван метод *EnableAlarms()*, то при каждом обновлении буфера производится проверка зон измерения.

<div align='left'>
    <img src="./sensor-data-processing.png" alt="Image not found">
</div>

</div>

### Зависимости
<div style = "color: #555">

- <mark style="background-color: lightblue">[plcAppError](../../plcAppError/res/README.md)</mark>
</div>

</div>