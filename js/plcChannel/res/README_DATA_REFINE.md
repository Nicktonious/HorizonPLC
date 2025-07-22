<div style = "font-family: 'Open Sans', sans-serif; font-size: 16px">

# ClassTransform
<div style = "color: #555">
    <p align="center">
    <img src="./res/logo.png" width="400" title="hover text">
    </p>
</div>

### Описание
<div style = "color: #555">

Сервисный класс из стека [ModuleSensor](README.md). Предназначен для обеспечении математической обработки считанных с датчика значений и позволяет настроить трансформацию значений согласно выбранной пользователем функции (линейной либо иной).

Объект класса автоматически инициализируется в поле *_Transform* класса [ClassChannelSensor](./README_CHANNEL.md). Методы для преобразования данных вызываются автоматически при обработке значений измерительного канала.

</div>

### Поля
<div style = "color: #555">

- <mark style="background-color: lightblue">_TransformFunc</mark> - функция трансформации, которая вызывается из ClassChannelSensor при обработке показаний измерительного канала. По-умолчанию равна `f(x): x => x` и не влияет на показания, но может быть переопределена пользователем;

</div>

### Методы
<div style = "color: #555">

- <mark style="background-color: lightblue">SetFunc(_func)</mark> - устанавливает трансформационную функцию для канала. Вызов данного метода без передачи в него аргумента, установит функцию по-умолчанию;
- <mark style="background-color: lightblue">SetLinearFunc(_k, _b)</mark> - устанавливает линейную функцию с коэффициентами k и b;
- <mark style="background-color: lightblue">TransformValue(val)</mark> - возвращает значение, прошедшее через трансформирующую функцию.

<div align='left'>
    <img src="./res/math.png" alt="Image not found">
</div>
</div>

# ClassSuppression

### Описание
<div style = "color: #555">

Сервисный класс из стека [ModuleSensor](README.md). Предназначен для обеспечении математической обработки считанных с датчика значений и позволяет настроить ограничение (супрессию) входных значений для отдельно взятого канала:

Объект класса автоматически инициализируется в поле *_Suppression* класса [ClassChannelSensor](./README_CHANNEL.md). Методы для преобразования данных вызываются автоматически при обработке значений измерительного канала.

</div>

### Поля
<div style = "color: #555">

- <mark style="background-color: lightblue">_Low</mark> - число, нижняя граница. По-умолчанию **-Infinity**;
- <mark style="background-color: lightblue">_High</mark> - число, верхняя граница. По-умолчанию **Infinity**;

</div>

### Методы
<div style = "color: #555">

- <mark style="background-color: lightblue">SetLim(_limLow, _limHigh)</mark> - устанавливает значения ограничителей входных значений;
- <mark style="background-color: lightblue">SuppressValue(val)</mark> - возвращает число, прошедшее через супрессорную функцию;

</div>

# ClassValueBuffer

### Описание
<div style = "color: #555">

Сервисный класс из стека [ModuleSensor](README.md). Предназначен для обеспечении математической обработки считанных с датчика значений и позволяет настроить размер буфера значений и фильтр-функцию измерительного канала датчика.

Объект класса автоматически инициализируется в поле *_Filter* класса [ClassChannelSensor](./README_CHANNEL.md). Методы для преобразования данных вызываются автоматически при обработке значений измерительного канала.

</div>

### Поля
<div style = "color: #555">
- <mark style="background-color: lightblue">_depth</mark> - размер буфера;
- <mark style="background-color: lightblue">_arr</mark> - массив, в котором хранятся значения;
- <mark style="background-color: lightblue">_raw</mark> - последнее значение канала, без обработки;

</div>

### Методы
<div style = "color: #555">

- <mark style="background-color: lightblue">Clear(_func)</mark> - очищает буфер;
- <mark style="background-color: lightblue">SetFilterFunc(_func)</mark> - устанавливает фильтр-функцию; при вызове без передачи аргументов, *_FilterFunc* сбрасывается по-умолчанию;
- <mark style="background-color: lightblue">Filter(val)</mark> - возвращает результат фильтр-функции.

</div>

</div>

### Зависимости
<div style = "color: #555">

</div>

</div>