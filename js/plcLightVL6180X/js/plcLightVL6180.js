const ClassSensor = require('plcSensor.min.js');
/*
const IDENTIFICATION__MODEL_ID = 0x000;
const IDENTIFICATION__MODEL_REV_MAJOR = 0x001;
const IDENTIFICATION__MODEL_REV_MINOR = 0x002;
const IDENTIFICATION__MODULE_REV_MAJOR = 0x003;
const IDENTIFICATION__MODULE_REV_MINOR = 0x004;
const IDENTIFICATION__DATE_HI = 0x006;
const IDENTIFICATION__DATE_LO = 0x007;
const IDENTIFICATION__TIME = 0x008; // 16-bit

const SYSTEM__MODE_GPIO0 = 0x010;
const SYSTEM__MODE_GPIO1 = 0x011;
const SYSTEM__HISTORY_CTRL = 0x012;
const SYSTEM__INTERRUPT_CONFIG_GPIO = 0x014;
*/
const SYSTEM__INTERRUPT_CLEAR = 0x015;
const SYSTEM__FRESH_OUT_OF_RESET = 0x016;
// const SYSTEM__GROUPED_PARAMETER_HOLD = 0x017;

const SYSRANGE__START = 0x018;
/*const SYSRANGE__THRESH_HIGH = 0x019;
const SYSRANGE__THRESH_LOW = 0x01a;*/
const SYSRANGE__INTERMEASUREMENT_PERIOD = 0x01b;
const SYSRANGE__MAX_CONVERGENCE_TIME = 0x01c;
// const SYSRANGE__CROSSTALK_COMPENSATION_RATE = 0x01e; // 16-bit
const SYSRANGE__CROSSTALK_VALID_HEIGHT = 0x021;
// const SYSRANGE__EARLY_CONVERGENCE_ESTIMATE = 0x022; // 16-bit
const SYSRANGE__PART_TO_PART_RANGE_OFFSET = 0x024;
/*const SYSRANGE__RANGE_IGNORE_VALID_HEIGHT = 0x025;
const SYSRANGE__RANGE_IGNORE_THRESHOLD = 0x026; // 16-bit
const SYSRANGE__MAX_AMBIENT_LEVEL_MULT = 0x02c;*/
const SYSRANGE__RANGE_CHECK_ENABLES = 0x02d;
const SYSRANGE__VHV_RECALIBRATE = 0x02e;
const SYSRANGE__VHV_REPEAT_RATE = 0x031;

const SYSALS__START = 0x038;
/*const SYSALS__THRESH_HIGH = 0x03a;
const SYSALS__THRESH_LOW = 0x03c;*/
const SYSALS__INTERMEASUREMENT_PERIOD = 0x03e;
const SYSALS__ANALOGUE_GAIN = 0x03f;
const SYSALS__INTEGRATION_PERIOD = 0x040;

/*const RESULT__RANGE_STATUS = 0x04d;
const RESULT__ALS_STATUS = 0x04e;
const RESULT__INTERRUPT_STATUS_GPIO = 0x04f;*/
const RESULT__ALS_VAL = 0x050; // 16-bit
/*
const RESULT__HISTORY_BUFFER_0 = 0x052; // 16-bit
const RESULT__HISTORY_BUFFER_1 = 0x054; // 16-bit
const RESULT__HISTORY_BUFFER_2 = 0x056; // 16-bit
const RESULT__HISTORY_BUFFER_3 = 0x058; // 16-bit
const RESULT__HISTORY_BUFFER_4 = 0x05a; // 16-bit
const RESULT__HISTORY_BUFFER_5 = 0x05c; // 16-bit
const RESULT__HISTORY_BUFFER_6 = 0x05e; // 16-bit
const RESULT__HISTORY_BUFFER_7 = 0x060; // 16-bit
*/
const RESULT__RANGE_VAL = 0x062;
/*
const RESULT__RANGE_RAW = 0x064;
const RESULT__RANGE_RETURN_RATE = 0x066; // 16-bit
const RESULT__RANGE_REFERENCE_RATE = 0x068; // 16-bit
const RESULT__RANGE_RETURN_SIGNAL_COUNT = 0x06c; // 32-bit
const RESULT__RANGE_REFERENCE_SIGNAL_COUNT = 0x070; // 32-bit
const RESULT__RANGE_RETURN_AMB_COUNT = 0x074; // 32-bit
const RESULT__RANGE_REFERENCE_AMB_COUNT = 0x078; // 32-bit
const RESULT__RANGE_RETURN_CONV_TIME = 0x07c; // 32-bit
const RESULT__RANGE_REFERENCE_CONV_TIME = 0x080; // 32-bit
*/
const RANGE_SCALER = 0x096; // 16-bit - see STSW-IMG003 core/inc/vl6180x_def.h

const READOUT__AVERAGING_SAMPLE_PERIOD = 0x10a;
/*const FIRMWARE__BOOTUP = 0x119;
const FIRMWARE__RESULT_SCALER = 0x120;*/
const I2C_SLAVE__DEVICE_ADDRESS = 0x212;
const INTERLEAVED_MODE__ENABLE = 0x2a3;
/**
 * @class
 * Класс предназначен для работы c цифровым двухканальным датчиком VL6180
 */
class ClassVL6180 extends ClassSensor {
    constructor(_opts) {
        ClassSensor.call(this, _opts);
        this._Address = this._Address || 0x29;
        this.Init();
        this._MinPeriod = 20;
    }

    Init() {
        this.SetAddress(this._Address);
        this._Scaling = 0;
        this._ptpOffset = 0;
        this._scalerValues = new Uint16Array([0, 253, 127, 84]);
        // Store part-to-part range offset so it can be adjusted if scaling is changed
        this._ptpOffset = this.Read8bit(SYSRANGE__PART_TO_PART_RANGE_OFFSET);
        let resetReg = this.Read8bit(SYSTEM__FRESH_OUT_OF_RESET);
        if (resetReg === 1) {
            this._Scaling = 1;
            this.Write8bit(0x207, 0x01);
            this.Write8bit(0x208, 0x01);
            this.Write8bit(0x096, 0x00);
            this.Write8bit(0x097, 0xfd); // RANGE_SCALER = 253
            this.Write8bit(0x0e3, 0x00);
            this.Write8bit(0x0e4, 0x04);
            this.Write8bit(0x0e5, 0x02);
            this.Write8bit(0x0e6, 0x01);
            this.Write8bit(0x0e7, 0x03);
            this.Write8bit(0x0f5, 0x02);
            this.Write8bit(0x0d9, 0x05);
            this.Write8bit(0x0db, 0xce);
            this.Write8bit(0x0dc, 0x03);
            this.Write8bit(0x0dd, 0xf8);
            this.Write8bit(0x09f, 0x00);
            this.Write8bit(0x0a3, 0x3c);
            this.Write8bit(0x0b7, 0x00);
            this.Write8bit(0x0bb, 0x3c);
            this.Write8bit(0x0b2, 0x09);
            this.Write8bit(0x0ca, 0x09);
            this.Write8bit(0x198, 0x01);
            this.Write8bit(0x1b0, 0x17);
            this.Write8bit(0x1ad, 0x00);
            this.Write8bit(0x0ff, 0x05);
            this.Write8bit(0x100, 0x05);
            this.Write8bit(0x199, 0x05);
            this.Write8bit(0x1a6, 0x1b);
            this.Write8bit(0x1ac, 0x3e);
            this.Write8bit(0x1a7, 0x1f);
            this.Write8bit(0x030, 0x00);
            this.Write8bit(SYSTEM__FRESH_OUT_OF_RESET, 0);
        } else {
            // Sensor has already been initialized, so try to get scaling settings by
            // reading registers.
            let s = this.Read16bit(RANGE_SCALER);
            if (s === this._scalerValues[3]) {
                this._Scaling = 3;
            } else if (s === this._scalerValues[2]) {
                this._Scaling = 2;
            } else {
                this._Scaling = 1;
            }
            // Adjust the part-to-part range offset value read earlier to account for
            // existing scaling. If the sensor was already in 2x or 3x scaling mode,
            // precision will be lost calculating the original (1x) offset, but this can
            // be resolved by resetting the sensor and Arduino again.
            this._ptpOffset *= this._Scaling;
        }
        this.Configure();
    }

    Start(_ch_num, _period) {
        if (typeof _ch_num !== 'number' || _ch_num !== E.clip(_ch_num, 0, 1)) throw new Error('Invalid arg');
        this._Channels[_ch_num].Status = 1;
        if (!this._Interval) {  
            _period = typeof _period != 'number' ? 100 : _period;
            let periodReg = _period / 10 - 1;
            periodReg = E.clip(periodReg, 0, 254);
            //если в данный момент не не ведется ни один опрос

            this.Write8bit(INTERLEAVED_MODE__ENABLE, 1);
            // this.Write8bit(SYSALS__INTERMEASUREMENT_PERIOD, periodReg);
            this.Write8bit(SYSALS__START, 0x03);
        
            this._Interval = setInterval(() => {       //запуск опроса 
                if (this._Channels[0] && this._Channels[0].Status) {
                    let ambient = this.Read16bit(RESULT__ALS_VAL);
                    ambient = (0.32 * ambient) / 1.01;  // перевод полученного значения в lux'ы соответственно к даташиту (section 2.13.4)
                    this._Channels[0].Value = ambient;
                }
                if (this._Channels[1] && this._Channels[1].Status) {
                    let range = this.Read8bit(RESULT__RANGE_VAL);
                    range = (range === 255) ? Infinity : range;
                    this._Channels[1].Value = range;
                }
                this.Write8bit(SYSTEM__INTERRUPT_CLEAR, 0x03);  // Очистка всех прерываний                
            }, _period);                         
        }
        return true;
    }

    Stop(_ch_num) {
        if (typeof _ch_num != 'number' || _ch_num !== E.clip(_ch_num, 0, 1)) return false;
        
        this._Channels[_ch_num].Status = 0;
        if (!this._Channels.find(_ch => _ch.Status)) {
            clearInterval(this._Interval);
            this._Interval = null;
            this.Write8bit(SYSRANGE__START, 0x01);
            this.Write8bit(SYSALS__START, 0x01);
            this.Write8bit(INTERLEAVED_MODE__ENABLE, 0);
        }
        return true;
    }
    
    Configure() {
        // "Recommended : Public registers"
        // readout__averaging_sample_period = 48
        this.Write8bit(READOUT__AVERAGING_SAMPLE_PERIOD, 0x30);
        // sysals__analogue_gain_light = 6 (ALS gain = 1 nominal, actually 1.01 according to Table 14 in datasheet)
        this.Write8bit(SYSALS__ANALOGUE_GAIN, 0x46);
        // sysrange__vhv_repeat_rate = 255
        // (auto Very High Voltage temperature recalibration after every 255 range measurements)
        this.Write8bit(SYSRANGE__VHV_REPEAT_RATE, 0xff);
        // sysals__integration_period = 99 (100 ms)

        // AN4545 incorrectly recommends writing to register 0x040;
        // 0x63 should go in the lower byte, which is register 0x041.
        this.Write16bit(SYSALS__INTEGRATION_PERIOD, 0x0063);
        // sysrange__vhv_recalibrate = 1 (manually trigger a VHV recalibration)
        this.Write8bit(SYSRANGE__VHV_RECALIBRATE, 0x01);

        // "Optional: Public registers"
        // sysrange__intermeasurement_period = 9 (100 ms)
        this.Write8bit(SYSRANGE__INTERMEASUREMENT_PERIOD, 0x09);
        // sysals__intermeasurement_period = 49 (500 ms)
        this.Write8bit(SYSALS__INTERMEASUREMENT_PERIOD, 0x31);
        // als_int_mode = 4 (regAddr.ALS new sample ready interrupt); range_int_mode = 4
        // (range new sample ready interrupt)
        // this.Write8bit(SYSTEM__INTERRUPT_CONFIG_GPIO, 0x24);   //NOTE
        // Reset other settings to power-on defaults
        // sysrange__max_convergence_time = 49 (49 ms)
        this.Write8bit(SYSRANGE__MAX_CONVERGENCE_TIME, 0x31);
        // Отключение прерываний (тк не используются)
        // this.Write8bit(SYSTEM__INTERRUPT_CONFIG_GPIO, 0x00);
        this.Write8bit(INTERLEAVED_MODE__ENABLE, 0);
        this.Write8bit(SYSALS__START, 0);
        // reset range scaling factor to 1x
        this.SetScaling(1);
    }

    Write8bit(reg, val8bit) {
        this._Bus.writeTo(this._Address, (reg >> 8) & 0xff, reg & 0xff, val8bit);
    }

    Write16bit(reg, val16bit) {
        this._Bus.writeTo(
            this._Address,
            (reg >> 8) & 0xff,
            reg & 0xff,
            (val16bit >> 8) & 0xff,
            val16bit & 0xff
        );
    }

    Read8bit(reg) {
        this._Bus.writeTo(this._Address, (reg >> 8) & 0xff, reg & 0xff);
        let data = this._Bus.readFrom(this._Address, 1);
        return data[0];
    }

    Read16bit(reg) {
        this._Bus.writeTo(this._Address, (reg >> 8) & 0xff, reg & 0xff);
        let data = this._Bus.readFrom(this._Address, 2);
        return (data[0] << 8) + data[1];
    }

    SetAddress(newAddr) {
        this.Write8bit(I2C_SLAVE__DEVICE_ADDRESS, newAddr & 0x7f);
        this._Address = newAddr;
    }

    SetScaling(newScaling) {
        let DefaultCrosstalkValidHeight = 20; // default value of SYSRANGE__CROSSTALK_VALID_HEIGHT

        // do nothing if scaling value is invalid
        if (newScaling < 1 || newScaling > 3) {
            return;
        }

        this._Scaling = newScaling;
        this.Write16bit(RANGE_SCALER, this._scalerValues[this._Scaling]);
        // apply scaling on part-to-part offset
        this.Write8bit(
            SYSRANGE__PART_TO_PART_RANGE_OFFSET,
            this._ptpOffset / this._Scaling
        );
        // apply scaling on CrossTalkValidHeight
        this.Write8bit(
            SYSRANGE__CROSSTALK_VALID_HEIGHT,
            DefaultCrosstalkValidHeight / this._Scaling
        );
        // This function does not apply scaling to RANGE_IGNORE_VALID_HEIGHT.
        // enable early convergence estimate only at 1x scaling
        let rce = this.Read8bit(SYSRANGE__RANGE_CHECK_ENABLES);
        this.Write8bit(
            SYSRANGE__RANGE_CHECK_ENABLES,
            (rce & 0xfe) | (this._Scaling === 1)
        );
    }
}

exports = ClassVL6180;