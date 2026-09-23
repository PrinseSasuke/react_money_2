import React from "react";
// prettier-ignore
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { useState } from "react";
import { useDayDate } from "../../hooks/useDayDate";
import { ru } from "react-day-picker/locale";
import styles from "./Calendar.module.scss";
import { Link } from "react-router-dom";

// "2026-09-22" -> "22.09" — без года, компактно для маленькой ячейки
const formatShortDate = (isoDate) => {
  const [, month, day] = isoDate.split("-");
  return `${day}.${month}`;
};

const formatSumm = (summ) => new Intl.NumberFormat("ru-RU").format(summ);

function Calendar() {
  const [selected, setSelected] = useState();
  return (
    <div className={styles.calendar}>
      <DayPicker
        ISOWeek
        className={styles.dayPicker}
        locale={ru}
        mode="single"
        selected={selected}
        onSelect={setSelected}
        components={{
          Day: (props) => {
            const { day, ...DayProps } = props;
            const dayDate = props["data-day"];
            const { summ } = useDayDate(dayDate);
            const isIncome = summ > 0;

            return (
              <td
                {...DayProps}
                className={`${DayProps.className || ""} ${styles.day}`}
                style={{ visibility: summ ? "visible" : "hidden" }}
              >
                <Link to={`/transactions/date/${dayDate}`}>
                  <button
                    className={`${styles.day_buttton} ${
                      isIncome ? styles.day_buttton__income : styles.day_buttton__expense
                    }`}
                    disabled={!useDayDate(dayDate)}
                  >
                    <span className={styles.day__date}>{formatShortDate(dayDate)}</span>
                    {summ ? (
                      <span className={styles.summ} title={`Итого: ${summ}`}>
                        {formatSumm(summ)}
                      </span>
                    ) : null}
                  </button>
                </Link>
              </td>
            );
          },
        }}
      />
    </div>
  );
}

export default Calendar;
