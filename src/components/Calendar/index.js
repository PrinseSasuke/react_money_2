import React from "react";
// prettier-ignore
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { useState } from "react";
import { useDayDate } from "../../hooks/useDayDate";
import { ru } from "react-day-picker/locale";
import styles from "./Calendar.module.scss";
import { Link } from "react-router-dom";
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

            return (
              <td
                className={styles.day}
                {...DayProps}
                style={{ visibility: summ ? "visible" : "hidden" }}
              >
                <Link to={`/transactions/date/${dayDate}`}>
                  <button
                    className={styles.day_buttton}
                    disabled={!useDayDate(dayDate)}
                    style={{
                      backgroundColor: summ > 0 ? "#CDFFCD" : "#FFE0E0",
                      color: summ > 0 ? "#007F00" : "#D30000",
                    }}
                  >
                    <div className={styles.day__date}>{dayDate}</div>
                    <div className={styles.day__result}>
                      <span>{!summ || "Итого: "}</span>

                      <span className={styles.summ}>{summ || null}</span>
                    </div>
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
