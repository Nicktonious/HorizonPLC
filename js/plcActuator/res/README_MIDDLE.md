<div style = "font-family: 'Open Sans', sans-serif; font-size: 16px">

# ClassBaseActuator
<div style = "color: #555">
    <p align="center">
    <img src="./res/logo.png" width="400" title="hover text">
    </p>
</div>

## Описание
<div style = "color: #555">

Является ключевой составляющей модуля [plcActuator](./README.md). Смысл данного класса заключается в унификации работы с актуаторами и их каналами, что упрощает работу прикладным разработчикам в рамках фрейморка Horizon Automated. Наследуется от [ClassDevice](../../plcDevice/res/README.md).
Реализует важнейшие принципы **plcActuator**:
- Обработка вх. сигнала: в точке запуска базового метода работы актуатора есть прослойка, через которую проходит ключевой аргумент (частота), позволяя применять ограничительные функции, трансформирующую линейную функцию и проверку значения на нахождение в заданных зонах. Это позволяет предотвращать ошибки, связанные с передачей некорректных аргументов (см. подробнее в [Transform, Suppression, ValueBuffer](./README_DATA_REFINE.md#обработка-значений-с-датчика));
- Автоматическое создание каналов: при инициализации "реального" актутора рассматриваемый класс автоматически создает [объекты-каналы](./README_CHANNEL.md), которые композируются в поле этого класса. Класс канала актуаторов наследуется от [ClassChannel](../../plcChannel/res/README.md);
- Определение сигнатур методов: класс определяет сигнатуры основных методов, которые после переопределения будут доступны для работы с "реальными" актуаторами и их каналами. Это обеспечивает единый интерфейс для инициализации, запуска, настройки и управления актуаторами.
</div>

### Поля
<div style = "color: #555">

- <mark style="background-color: lightblue">_Channels</mark> - массив с автоматически инстанцирующимися объектами ClassChannelActuator;

Остальные свойства объявлены в **ClassDevice**.

</div>

### Аксессоры
<div style = "color: #555">

- <mark style="background-color: lightblue">CountChannels</mark> - геттер, возвращающий количество корректно инициализированных каналов типа **ClassChannelActuator**.

Остальные аксессоры объявлены в **ClassDevice**.

</div>

### Методы
<div style = "color: #555">

- <mark style="background-color: lightblue">SetValue(_chNum, _val, _opts)</mark> - обязывает начать работу определенного канала актуатора;
- <mark style="background-color: lightblue">Off(_chNum, _opts)</mark> - обязывает прекратить подачу питания на актуатор.

Остальные методы объявлены в **ClassDevice**.

</div>

### Зависимости
<div style = "color: #555">

- <mark style="background-color: lightblue">[ClassAppError](https://github.com/Konkery/ModuleAppError/blob/main/README.md)</mark>
</div>

</div>