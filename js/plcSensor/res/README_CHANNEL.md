<div style = "font-family: 'Open Sans', sans-serif; font-size: 16px">

# ClassChannel
<div style = "color: #555">
    <p align="center">
    <img src="logo.png" width="400" title="hover text">
    </p>
</div>

### Описание
<div style = "color: #555">

Компонент [ModuleSensor](./README_MIDDLE.md), который представляет каждый отдельно взятый канал датчика. В парадигме фреймворка Horizon Automated именно через объект этого класса происходит прикладная работа с датчиком. Является "синглтоном" для основного объекта датчика. Хранит в себе ссылки на основной объект сенсора и "проброшенные" методы для работы с данным каналом датчика, включая аксессоры. 

Является наследником класса [ClassChannel](../../plcChannel/res/README.md). В отличии от ClassChannel, его перечень сервисных классов (см. [DataRefine](../../plcChannel/res/README_DATA_REFINE.md)) содержит [ClassBufferValue](../../plcChannel/res/README_DATA_REFINE.md#classvaluebuffer), реализующий функционал буфера.

Функционал класса:
- Унификация хранения значений: класс организует хранение считанных значений с датчика в [буфере](../../plcChannel/res/README_DATA_REFINE.md#classvaluebuffer), результирующее значение с которого можно получить через аксессор *Value*; Сохранение нового значения также выполняется через аксессор **Value**.   
- Обработка данных через аксессоры: упомянутые выше аксессоры служат единой прослойкой, через которую проходят данные, позволяя применять ограничительные функции, трансформирующую линейную функцию, фильтрацию и проверку на нахождение в заданных зонах измерения. Это обеспечивает надежную и легко расширяемую обработку данных с датчика (см. подробнее в [соответствующем разделе](./README_DATA_REFINE.md#обработка-значений-с-датчика));
- Вызов методов объекта датчика, ассоциировнных с данным каналом.

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
                    "address": "/Horizon/PLC11/light"
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
                "address": "/Horizon/PLC11/range",
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

### Поля
<div style = "color: #555">

- <mark style="background-color: lightblue">_ValueBuffer</mark> - буффера фиксированной длины, в котором сохраняются необработанные показания датчика;
- <mark style="background-color: lightblue">_DataUpdated</mark> - флаг указывающий на то что сохраненное ранее значение *_Value* уже не является актуальным;
- <mark style="background-color: lightblue">_DataWasRead</mark> - флаг указывающий на то что последнее актуальное значение *Value* уже было считано и сохранено;

</div>

### Аксессоры
<div style = "color: #555">

- <mark style="background-color: lightblue">Buffer</mark> - возвращает объект *ClassValueBuffer*;


</div>

### Методы
<div style = "color: #555">

- <mark style="background-color: lightblue">Start(_chNum, _period, _opts)</mark>
- <mark style="background-color: lightblue">Stop(_chNum)</mark>
- <mark style="background-color: lightblue">ChangeFreq(_chNum, _period)</mark>
- <mark style="background-color: lightblue">SetRepeatability(_chNum, _rep)</mark>
- <mark style="background-color: lightblue">SetPrecision(_chNum, _pres)</mark>

Некоторые из этих методов ссылаются на соответствующий функционал, объявленный в **ClassSensor** и реализованный в прикладном классе датчика. Развернутое описание данных методов [по ссылке](./README_MIDDLE.md#методы).

</div>

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