<div style = "font-family: 'Open Sans', sans-serif; font-size: 16px">

# ModuleProxyMQTT
<div style = "color: #555">
<p align="center">
    <img src="logo.png" width="400" title="hover text">
    </p>
</div>

## Лицензия
<div style = "color: #555">В разработке</div>

## Описание
<div style = "color: #555">

Модуль ProxyMQTT предназначен для обеспечения обмена сообщениями между MQTT-брокером и некоторыми системными службами фреймворка Horizon Automated. 
Представляет из себя не самостоятельное звено, а прокси-прослойку к объекту класса [ClassMQTTGW](../../plcMQTTGW/res/README.md) (далее - *MQTT*), которая управляет двунаправленным обменом данными между издателем и службой [DeviceManager](../../plcDeviceManager/res/README.md).
Обмен сообщениями со службой построен на событийной модели, а взаимодействие с *MQTT* происходит напрямую. 
Собственно модуль выполняет две операции:
- Перехватывает команды с брокера их маршрутизирует их системным службам;
- Перехватывает сообщения от служб и перенаправляет их на брокер.

Также ProxyMQTT позволяет регулировать поток сообщений, рассылая их пакеты согласно установленной частоте. Это необходимо для работы с брокером, на котором стоит ограничение на кол-во возможных обновлений каждого отдельного топика. Под пакетом подразумевается набор сообщений, каждое из которых предназначено для отдельного топика. 

Ниже приведена диаграмма, отображающая роль модуля в цепочке MQTT-брокер - DevicesManager. 

<div align='center'>
    <img src='./proxyMQTT-arсhitecture.png'>
</div>

</div>

### Конструктор
Объект создается исключительно в качестве значения поля *_Proxy* в **ClassMQTTServer**. При инициализации конструктор принимает ссылку на объект типа *ClassMQTTGW*:
<div style = "color: #555">

```js
//внутри конструктора ClassMQTTServer
...
this._Proxy = new ClassProxyMQTT(this);
...
```
</div>

### Поля
<div style = "color: #555">

- <mark style="background-color: lightblue">_MQTT</mark> - ссылка на объект *MQTT* (publisher);
- <mark style="background-color: lightblue">_Subs</mark> - объект, хранящий информацию о подписках на системные службы; по умолчанию имеет вид `{ dm: { 'sensor': [], 'actuator': [] } }`;
- <mark style="background-color: lightblue">_SkipData</mark> - флаг, при взведении которого данные не отправляются на *MQTT*;
- <mark style="background-color: lightblue">_DataSkipInterval</mark> - интервал, управляющий флагом *_SkipData*.
</div>

### События
<div style = "color: #555">

Модуль подписан на следующие события:  
- <mark style="background-color: lightblue">proxymqtt-sub-sensorall</mark> – сообщение-ответ на подписку на все показания измерительных каналов ('dm-sub-sensorall');  
- <mark style="background-color: lightblue">all-data-raw-get</mark> – рассылка показаний измерительных каналов;  
- <mark style="background-color: lightblue">connected</mark> – подключение MQTT GW;  
- <mark style="background-color: lightblue">publish</mark> – публикация сообщения службой MQTT GW;  
- <mark style="background-color: lightblue">disconnected</mark> – отключения MQTT GW;  
- <mark style="background-color: lightblue">error</mark> – обработка ошибки в MQTT GW.
</div>

### Методы
<div style = "color: #555">

- <mark style="background-color: lightblue">HandlerEvents_all_data_raw(_msg)</mark> - - обрабатывает данные, полученные от DeviceManager; перенаправляет данные на MQTT GW; 
- <mark style="background-color: lightblue">HandlerEvents_proxymqtt_sub_sensorall(_msg)</mark> - обработчик сообщения от DM; сохраняет данные для маппинга каналов с топиками; инициирует подписку на топики каналов сенсоров; 
- <mark style="background-color: lightblue">Receive(_data, _key)</mark> - принимает сообщение, поступившее на *MQTT*;
- <mark style="background-color: lightblue">Send(msg)</mark> - отправляет на *MQTT* сообщение и название предназначенного для него топика;
- <mark style="background-color: lightblue">OnPublish(pub)</mark> - обрабатывает событие 'publish' MQTT GW; формирует сообщение соответствующей службе; 
- <mark style="background-color: lightblue">OnDisconnected()</mark> - обрабатывает событие 'disconnected' MQTT GW;
- <mark style="background-color: lightblue">OnConnected()</mark> - обрабатывает событие 'connected' MQTT GW;
- <mark style="background-color: lightblue">OnError(e)</mark> - обрабатывает событие 'error' MQTT GW;
- <mark style="background-color: lightblue">SetPubMaxFreq(_freq)</mark> - устанавливает максимальную частоту отправки сообщений на *MQTT*.
</div>

### Подписка на DeviceManager
<div style = "color: #555">

Процесс сопоставления инициализированных измерительных и исполнительных каналов с соответствующими топиками, подписка на них выполняется автоматически.

Пользователю достаточно в конфигурации каналов девайсов задать полю `address` имя необходимого топика. Далее выполнится следующий алгоритм:
1. **proxymqtt** по событию `connected` **mqttgw** посылает на **dm** сообщение `dm-sub-sensorall`
```js
{
	metadata: { source: 'proxymqtt' },
	com: 'dm-sub-sensorall'
}
```
2.dm отвечает на него сообщением `proxymqtt-sub-sensorall`, в котором передаст данные для маппинга, собранные с каналов;

Итоговый маппинг-объект выглядит следующим образом:
```js
{
	com: 'proxymqtt-sub-sensorall',
	value: [
		{
			sensor:   [ { name: 'gl-0', address: 'topic1' }, ...],
			actuator: [ { name: 'led-0', address: 'topic2' }, ... ]
		}
	]
}
```

3. Далее **proxymqtt** сохраняет маппинг-таблицу в своем поле, указывает **mqttgw** выполнить подписку на все топики, маппирующиеся с актуаторами.

</div>

### Зависимости
<div style = "color: #555">

- <mark style="background-color: lightblue">[plcMQTTGW](../../plcMQTTGW/res/README.md)</mark>
- <mark style="background-color: lightblue">[plcAppError](../../plcAppError/res/README.md)</mark>

</div>

</div>