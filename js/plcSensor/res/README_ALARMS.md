<div style = "font-family: 'Open Sans', sans-serif; font-size: 16px">

# ClassAlarms
<div style = "color: #555">
    <p align="center">
    <img src="./res/logo.png" width="400" title="hover text">
    </p>
</div>

### Описание
<div style = "color: #555">

Класс реализует определение измерительных зон канала. 
Измерительные зоны представляют собой определенные диапазоны значений, в пределах которых измерительное оборудование, такое как датчики или сенсоры, выполняет измерения и считывает данные. В SCADA системах измерительные зоны часто используются для определения нормального и ненормального состояния системы, а также для установления граничных значений, в пределах которых параметры должны находиться.
Алармы представляют собой механизмы оповещения или предупреждения, которые срабатывают, когда измеренные значения выходят за пределы заданных. 

<div align='center'>
    <img src="./res/zones_low_res.png" alt="Image not found">
</div>
</div>

### Поля
<div style = "color: #555">

- <mark style="background-color: lightblue">_Zones</mark> - массив со значениями границ, которые задают зоны измерения;
- <mark style="background-color: lightblue">_Callbacks</mark> - массив с коллбэками к измерительным зонам;
- <mark style="background-color: lightblue">_CurrZone</mark> - строковое представление текущей зоны.
</div>

### Методы
<div style = "color: #555">
- <mark style="background-color: lightblue">SetDefault(opts)</mark> - устанавливает значения полей класса по-умолчанию;
- <mark style="background-color: lightblue">SetZones(opts)</mark> - задает зоны измерения и их функции-обработчики
- <mark style="background-color: lightblue">CheckZone(opts)</mark> - обновляет значение текущей зоны измерения по переданному значению и, если зона сменилась, вызывает её коллбэк.
</div>

### Примеры
<div style = "color: #555">

Замечание! Передаваемые значения *low* и *high* не являются левой и правой границами зоны. *low* указывает значение, ниже которого начинается нижняя красная/желтая зона, а *high* - значение выше которого идёт верхняя красная/жёлтая зона. При чем зона ВСЕГДА задается парой значений, а если же для прикладной работы необходима только верхняя либо нижняя зоны, то рудиментарную зону всегда можно стянуть в недостижимое значение +-Infinity.  
Правила, задания значений:
- red.low < yellow.low
- red.high > yellow.high
- при повторном вызове `SetZones(opts)` проверка значений на валидность происходит таким образом: 
    1. новые значения желтой/красной зон сверяются со значениями красной/желтой зон если такие также были переданы
    2. если же была передана только красная либо желтая зона, то ее значения сверяются со значениями зон, указанными прежде. 
- коллбэки при вызове получают как аргумент ссылку на объект канала и на значение предыдущей зоны;
- вызов `SetZones()` без передачи аргумента сбрасывает все установленные ранее зоны.

#### Установка всех измерительных зон
```js
tmprt.EnableAlarms();
tmprt.Alarms.SetZones({         
    red: {              
        low:   0, 
        high:   25, 
        cbLow:  (prev) => { console.log('Extremely cold!'); },  // Реакция на попадание в Красную нижнюю зону
        cbHigh: (prev) => { console.log('Extremely hot'); }     // в Красную верхнюю зону
    },
    yellow: {     
        low:   10, 
        high:   35, 
        cbLow:  (prev) => { console.log('Getting cold'); },     // Реакция на попадание в Желтую нижнюю зону
        cbHigh: (prev) => { console.log('Getting hot'); }       // в Желтую верхнюю зону
    },
    green: { 
        cb:     (ch, prev) => {                                 //ch - текущее значение канала
            console.log(`Temperature is Ok: ${ch}`);            // Реакция на попадание в Зеленую зону
        } 
    }
});
```

#### Установка только верхних измерительных зон
```js
ch0.EnableAlarms();
ch0.Alarms.SetZones({         
    red: {              //Красная зона
        low:   -Infinity, 
        high:   100, 
        cbHigh: (prev) => { console.log('High red'); }
    },
    yellow: {           //Желтая зона
        low:   -Infinity, 
        high:   50, 
        cbHigh: (ch, prev) => { console.log('High yellow ' + ch.Value); } 
    },
    green: {            //Зеленая зона
        cb:     (ch, prev) => { console.log(`Left ${prev} zone, now in Green zone`); } 
                  // prev - название зоны, которую покинул измерительный канал
    }
});
```

##### Установка зон по отдельности
```js
ch1.EnableAlarms();
ch1.Alarms.SetZones({         
    red: {              //Красная зона
        low:   -100, 
        high:   100, 
        cbLow:  () => { console.log('Low red'); }, 
        cbHigh: () => { console.log('High red'); }
    }
});

//Для примера установка желтой зоны пропускается
ch1._Alarms.SetZones({
    green: {            //Зеленая зона
        cb: (ch, prevZone) => { console.log(`Left ${prevZone}, now GREEN zone`); } 
    }
});
```
</div>

##### Подписка на события зон
```js
ch1.EnableAlarms();
ch1.on('redLow',  () => { console.log('Low red'); });
ch1.on('redHigh', () => { console.log('High red'); });
```

### Зависимости
<div style = "color: #555">

</div>

</div>