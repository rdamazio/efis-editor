export class GrtLiveData {
  private static readonly GRT_FIELD = /%(?<fieldnum>\d{1,3})%/;

  public static replaceLiveDataFields(value: string): string {
    let match = value.match(this.GRT_FIELD);
    while (match?.groups) {
      const fieldNum = parseInt(match.groups['fieldnum'], 10);
      const replaceWith = this._replacementFor(fieldNum);
      if (!replaceWith) {
        // Unknown field - stop processing this value.
        break;
      }

      value = value.replace(this.GRT_FIELD, replaceWith);

      // Look for the next one.
      match = value.match(this.GRT_FIELD);
    }
    return value;
  }

  private static _replacementFor(fieldNum: number): string | undefined {
    // Generate a random replacement value appropriate for the field type.
    switch (fieldNum) {
      case 0: // EIS1 RPM
      case 82: // EIS1 RPM2
      case 86: // EIS1 RPM3
      case 91: // EIS2 RPM
      case 92: // EIS2 RPM2
      case 93: // EIS2 RPM3
        return this._randomRange(2450, 2500);

      case 83: // EIS1 N1
      case 84: // EIS1 N2
      case 87: // EIS1 N3
      case 94: // EIS2 N1
      case 95: // EIS2 N2
      case 96: // EIS2 N3
      case 34: // ENGINE 1 PERCENT POWER
      case 130: // ENGINE 2 PERCENT POWER
        return this._randomRange(75, 80);

      case 1: // EIS1 EGT 1
      case 2: // EIS1 EGT 2
      case 3: // EIS1 EGT 3
      case 4: // EIS1 EGT 4
      case 5: // EIS1 EGT 5
      case 6: // EIS1 EGT 6
      case 7: // EIS1 EGT 7
      case 8: // EIS1 EGT 8
      case 9: // EIS1 EGT 9
      case 88: // EIS1 EGT 10
      case 89: // EIS1 EGT 11
      case 90: // EIS1 EGT 12
      case 97: // EIS2 EGT 1
      case 98: // EIS2 EGT 2
      case 99: // EIS2 EGT 3
      case 100: // EIS2 EGT 4
      case 101: // EIS2 EGT 5
      case 102: // EIS2 EGT 6
      case 103: // EIS2 EGT 7
      case 104: // EIS2 EGT 8
      case 105: // EIS2 EGT 9
      case 106: // EIS2 EGT 10
      case 107: // EIS2 EGT 11
      case 108: // EIS2 EGT 12
        return this._randomRange(1200, 1300);

      case 10: // EIS1 CHT 1
      case 11: // EIS1 CHT 2
      case 12: // EIS1 CHT 3
      case 13: // EIS1 CHT 4
      case 14: // EIS1 CHT 5
      case 15: // EIS1 CHT 6
      case 109: // EIS2 CHT 1
      case 110: // EIS2 CHT 2
      case 111: // EIS2 CHT 3
      case 112: // EIS2 CHT 4
      case 113: // EIS2 CHT 5
      case 114: // EIS2 CHT 6
        return this._randomRange(350, 370);

      case 24: // EIS1 OIL TEMPERATURE
      case 122: // EIS2 OIL TEMPERATURE
        return this._randomRange(200, 220);

      case 16: // EIS1 VOLTS
      case 115: // EIS2 VOLTS
      case 35: // EFIS VOLTS 1
      case 36: // EFIS VOLTS 2
      case 37: // EFIS VOLTS 3
      case 62: // AHRS VOLTS 1
      case 63: // AHRS VOLTS 2
      case 64: // AHRS VOLTS 3
        return this._randomRange(13.5, 13.8, 1);

      case 17: // EIS1 FUEL FLOW
      case 116: // EIS2 FUEL FLOW
      case 117: // OVERALL FUEL FLOW
        return this._randomRange(10, 11, 1);

      case 18: // EIS1 TEMPERATURE
      case 118: // EIS2 TEMPERATURE
      case 65: // AHRS TEMPERATURE
        return this._randomRange(35, 40);

      case 19: // EIS1 CARB TEMPERATURE
      case 119: // EIS2 CARB TEMPERATURE
        return this._randomRange(10, 15);

      case 20: // EIS1 COOLANT TEMPERATURE
      case 120: // EIS2 COOLANT TEMPERATURE
        return this._randomRange(10, 15);

      case 21: // EIS1 HOURMETER
      case 121: // EIS2 HOURMETER
        return '1234.5';

      case 22: // FUEL REMAINING
        return this._randomRange(10, 15);

      case 23: // FLIGHT TIME
        return '1.2';

      case 25: // EIS1 OIL PRESSURE
      case 123: // EIS2 OIL PRESSURE
        return this._randomRange(50, 55);

      case 26: // EIS1 AUX 1
      case 27: // EIS1 AUX 2
      case 28: // EIS1 AUX 3
      case 29: // EIS1 AUX 4
      case 30: // EIS1 AUX 5
      case 31: // EIS1 AUX 6
      case 124: // EIS2 AUX 1
      case 125: // EIS2 AUX 2
      case 126: // EIS2 AUX 3
      case 127: // EIS2 AUX 4
      case 128: // EIS2 AUX 5
      case 129: // EIS2 AUX 6
      case 38: // ANALOG AUX 1
      case 39: // ANALOG AUX 2
      case 40: // ANALOG AUX 3
      case 41: // ANALOG AUX 4
      case 42: // ANALOG AUX 5
      case 43: // ANALOG AUX 6
      case 44: // ANALOG AUX 7
      case 45: // ANALOG AUX 8
        return this._randomRange(1, 100);

      case 32: // FUEL ENDURANCE
        return this._randomRange(1, 1.1, 1);

      case 33: // FUEL RANGE
        return this._randomRange(100, 110);

      case 46: // OAT
        return this._randomRange(25, 30);

      case 47: // INDICATED AIRSPEED
      case 48: // TRUE AIRSPEED
      case 73: // GROUNDSPEED
        return this._randomRange(130, 135);

      case 49: // VERTICAL SPEED
        return this._randomRange(-100, 100);

      case 50: // ALTIMETER
      case 51: // PRESSURE ALTITUDE
      case 52: // DENSITY ALTITUDE
        return this._randomRange(7470, 7520);
      case 81: // SELECTED ALTITUDE
        return '7500';

      case 53: // BAROSET
        return '29.92';

      case 54: // AHRS ALIGNMENT
      case 55: // AHRS STATUS
      case 56: // AHRS ATTITUDE STATUS
      case 57: // AHRS ALTITUDE STATUS
        return 'OK';

      case 58: // AHRS ROLL
      case 59: // AHRS PITCH
      case 61: // AHRS SLIP
        return this._randomRange(-5, 5);

      case 72: // BEARING TO WAYPOINT
      case 60: // AHRS HEADING
      case 79: // SELECTED HEADING
      case 80: // SELECTED COURSE
        return this._randomRange(350, 352);

      case 66: // FLAPS
      case 67: // AILERON TRIM
      case 68: // ELEVATOR TRIM
      case 85: // RUDDER TRIM
        return '32.0';

      case 69: // ACTIVE WAYPOINT
        return 'CKLST';

      case 70: // ESTIMATED TIME TO WAYPOINT
        return '01:23:' + this._randomRange(20, 40);

      case 71: // RANGE TO WAYPOINT
        return this._randomRange(70, 71);

      case 74: // WIND SPEED
        return this._randomRange(5, 10);
      case 75: // WIND DIRECTION
        return this._randomRange(245, 250);

      case 76: // NAV MODE
        return 'NAV';
      case 77: // A/P MODE
        return 'ON'; // TODO: What are actual values that GRT returns here?
      case 78: // VNAV MODE
        return 'GS';
    }
    return undefined;
  }

  private static _randomRange(min: number, max: number, decimals = 0): string {
    const val = min + Math.random() * (max - min);
    return val.toFixed(decimals);
  }
}
