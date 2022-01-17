import React from 'react';
import { Wifi2, Power } from 'react-bootstrap-icons';
import { useSimVar } from '@instruments/common/simVars';
import { usePersistentProperty } from '@instruments/common/persistence';
import { usePower, PowerStates } from '../Efb';

import { BatteryStatus } from './BatteryStatus';

type StatusBarProps = {
    batteryLevel: number;
    isCharging: boolean;
};

export const StatusBar = ({ batteryLevel, isCharging }: StatusBarProps) => {
    const [currentUTC] = useSimVar('E:ZULU TIME', 'seconds');
    const [currentLocalTime] = useSimVar('E:LOCAL TIME', 'seconds');
    const [dayOfWeek] = useSimVar('E:ZULU DAY OF WEEK', 'number');
    const [monthOfYear] = useSimVar('E:ZULU MONTH OF YEAR', 'number');
    const [dayOfMonth] = useSimVar('E:ZULU DAY OF MONTH', 'number');

    const [timeDisplayed] = usePersistentProperty('EFB_TIME_DISPLAYED', 'utc');
    const [timeFormat] = usePersistentProperty('EFB_TIME_FORMAT');

    const power = usePower();

    const getDayName = (day: number) => ['Mon', 'Tue', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'][day];

    const getMonthName = (month: number) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1];

    const getZuluFormattedTime = (seconds: number) => `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')}z`;
    const getLocalFormattedTime = (seconds: number) => {
        if (timeFormat === '24') {
            return `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')}`;
        }
        const hours = Math.floor(seconds / 3600) % 12;
        const minutes = Math.floor((seconds % 3600) / 60);
        const ampm = Math.floor(seconds / 3600) >= 12 ? 'pm' : 'am';
        return `${hours === 0 ? 12 : hours}:${minutes.toString().padStart(2, '0')}${ampm}`;
    };

    return (
        <div className="flex fixed justify-between items-center px-6 w-full h-10 text-lg font-medium leading-none text-theme-text bg-theme-statusbar">
            <p>{`${getDayName(dayOfWeek)} ${getMonthName(monthOfYear)} ${dayOfMonth}`}</p>
            <div className="flex absolute inset-x-0 flex-row justify-center items-center mx-auto space-x-4 w-min">
                {(timeDisplayed === 'utc' || timeDisplayed === 'both') && (
                    <p>{getZuluFormattedTime(currentUTC)}</p>
                )}
                {timeDisplayed === 'both' && (
                    <p>/</p>
                )}
                {(timeDisplayed === 'local' || timeDisplayed === 'both') && (
                    <p>{getLocalFormattedTime(currentLocalTime)}</p>
                )}
            </div>
            <div className="flex items-center space-x-8">
                <div className="mb-1.5">
                    <Wifi2 size={32} />
                </div>

                <BatteryStatus batteryLevel={batteryLevel} isCharging={isCharging} />

                {/* Show overlay to either power down or restart when this is held down, set to standby mode otherwise */}
                <Power size={26} onClick={() => power.setPowerState(PowerStates.SHUTOFF)} />
            </div>
        </div>
    );
};
