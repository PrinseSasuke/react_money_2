import React from "react";
import styles from "./Side.module.scss";
import { Link } from "react-router-dom";
import LoginButton from "../Auth/LoginButton.js";
import LogoutButton from "../Auth/LogoutButton.js";
import Profile from "../Auth/Profile.js";
import { useTheme } from "../../hooks/useTheme";
import { useState } from "react";
function Side() {
  const [activeItem, setActiveItem] = useState("home");
  const { theme, toggleTheme } = useTheme();
  const getFillColor = (item) => (activeItem === item ? "#4E36FC" : "#1B1D4E");
  return (
    <div className={styles.slide}>
      <Link to="/">
        <div className={styles.topWrapper}>
          <img src="/img/logo.svg" alt="img" />
          <h1 className={styles.h1}>React-Money</h1>
        </div>
      </Link>
      <ul className={styles.menu}>
        <li className={styles.menu__item} onClick={() => setActiveItem("home")}>
          <Link to="/" style={{ display: "flex" }}>
            <svg
              width="19"
              height="17"
              viewBox="0 0 19 17"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M17.9211 7.5528L9.89645 0.240769C9.54422 -0.0802273 9.01307 -0.0801923 8.66099 0.240734L0.63629 7.55284C0.354139 7.80994 0.260939 8.20608 0.398783 8.56201C0.536662 8.91794 0.872365 9.1479 1.25407 9.1479H2.53575V16.474C2.53575 16.7645 2.77127 17 3.06174 17H7.46025C7.75071 17 7.98623 16.7645 7.98623 16.474V12.0258H10.5713V16.4741C10.5713 16.7645 10.8068 17 11.0973 17H15.4956C15.7861 17 16.0216 16.7646 16.0216 16.4741V9.1479H17.3035C17.6852 9.1479 18.0209 8.9179 18.1588 8.56201C18.2965 8.20605 18.2033 7.80994 17.9211 7.5528Z"
                fill={getFillColor("home")}
              />
            </svg>
            <span>Главная</span>
          </Link>
        </li>
        <li
          className={styles.menu__item}
          onClick={() => setActiveItem("history")}
        >
          <Link to="/transactions" style={{ display: "flex" }}>
            <svg
              width="21"
              height="18"
              viewBox="0 0 21 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15.0233 6.1518H20.5582V3.58203C20.5582 1.94705 19.228 0.616913 17.5931 0.616913H2.96511C1.33014 0.616913 0 1.94705 0 3.58203V14.6518C0 16.2868 1.33014 17.6169 2.96511 17.6169H17.5931C19.228 17.6169 20.5582 16.2868 20.5582 14.6518V12.082H15.0233C13.3883 12.082 12.0582 10.7519 12.0582 9.11691C12.0582 7.48194 13.3883 6.1518 15.0233 6.1518Z"
                fill={getFillColor("history")}
              />
              <path
                d="M15.0232 7.33786C14.0423 7.33786 13.2441 8.13593 13.2441 9.11694C13.2441 10.098 14.0422 10.896 15.0232 10.896H20.5581V7.3379H15.0232V7.33786ZM15.8139 9.70996H15.0232C14.6957 9.70996 14.4302 9.44443 14.4302 9.11694C14.4302 8.78946 14.6957 8.52393 15.0232 8.52393H15.8139C16.1414 8.52393 16.4069 8.78946 16.4069 9.11694C16.4069 9.44443 16.1414 9.70996 15.8139 9.70996Z"
                fill={getFillColor("history")}
              />
            </svg>
            <span> Мои операции</span>
          </Link>
        </li>
        <li
          className={styles.menu__item}
          onClick={() => setActiveItem("import")}
        >
          <Link to="/import" style={{ display: "flex" }}>
            <svg
              width="21"
              height="21"
              viewBox="0 0 21 21"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M14.7066 13.578C14.8247 12.6689 14.8247 11.7598 14.8247 10.8507C14.8247 9.94165 14.7793 9.03256 14.7066 8.12347H19.8884C20.4096 9.90429 20.4096 11.7972 19.8884 13.578H14.7066ZM12.6702 6.30528C12.0975 2.75074 10.9611 0.850739 10.2793 0.850739C9.59747 0.850739 8.4611 2.75074 7.88837 6.30528H12.6702ZM7.88837 15.3962C8.45201 18.9507 9.59747 20.8507 10.2793 20.8507C10.9611 20.8507 12.0975 18.9507 12.6702 15.3962H7.88837ZM12.8884 8.12347H7.67019C7.59746 8.96892 7.55201 9.86892 7.55201 10.8507C7.55201 11.8326 7.59746 12.7326 7.67019 13.578H12.8884C12.9611 12.7326 13.0066 11.8326 13.0066 10.8507C13.0066 9.86892 13.0066 8.96892 12.8884 8.12347ZM5.73383 10.8507C5.73383 9.94165 5.73383 9.03256 5.85201 8.12347H0.670192C0.148974 9.90429 0.148974 11.7972 0.670192 13.578H5.85201C5.77928 12.6689 5.73383 11.7598 5.73383 10.8507ZM6.0611 15.3962H1.37928C2.00621 16.6172 2.87778 17.6961 3.93974 18.5657C5.00171 19.4353 6.23131 20.077 7.55201 20.4507C6.79037 18.8555 6.28713 17.1494 6.0611 15.3962ZM14.4975 15.3962C14.2714 17.1494 13.7682 18.8555 13.0066 20.4507C14.3273 20.077 15.5569 19.4353 16.6188 18.5657C17.6808 17.6961 18.5524 16.6172 19.1793 15.3962H14.4975ZM14.4975 6.30528H19.1793C18.5524 5.08425 17.6808 4.00536 16.6188 3.13577C15.5569 2.26618 14.3273 1.62452 13.0066 1.25074C13.7682 2.84595 14.2714 4.55208 14.4975 6.30528ZM6.0611 6.30528C6.28713 4.55208 6.79037 2.84595 7.55201 1.25074C6.23131 1.62452 5.00171 2.26618 3.93974 3.13577C2.87778 4.00536 2.00621 5.08425 1.37928 6.30528H6.0611Z"
                fill={getFillColor("import")}
              />
            </svg>

            <span>Импорт</span>
          </Link>
        </li>
        <li
          className={styles.menu__item}
          onClick={() => setActiveItem("stats")}
        >
          <Link to="/stats" style={{ display: "flex" }}>
            <svg
              width="21"
              height="18"
              viewBox="0 0 21 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M15.2603 4.96271V7.99527L20.2761 3.97948L15.2603 -0.00106812V2.96271H13.1804H12.7662L12.4733 3.2556L3.2623 12.4666H0.28125V14.4666H3.67651H4.09073L4.38362 14.1737L13.5946 4.96271H15.2603Z"
                fill={getFillColor("stats")}
              />
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M15.2603 12.1986V9.16608L20.2761 13.1819L15.2603 17.1624V14.1986H13.1804H12.7662L12.4733 13.9057L3.2623 4.69472H0.28125V2.69472H3.67651H4.09073L4.38362 2.98761L13.5946 12.1986H15.2603Z"
                fill={getFillColor("stats")}
              />
            </svg>

            <span>Статистика</span>
          </Link>
        </li>
        <li
          className={styles.menu__item}
          onClick={() => setActiveItem("forecast")}
        >
          <Link to="/forecast" style={{ display: "flex" }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M17.5 18.9584H2.5C2.15833 18.9584 1.875 18.675 1.875 18.3334C1.875 17.9917 2.15833 17.7084 2.5 17.7084H17.5C17.8417 17.7084 18.125 17.9917 18.125 18.3334C18.125 18.675 17.8417 18.9584 17.5 18.9584Z"
                fill="#25282C"
              />
              <path
                d="M4.66665 16.4584H3.33333C2.53333 16.4584 1.875 15.8001 1.875 15.0001V7.81673C1.875 7.01673 2.53333 6.3584 3.33333 6.3584H4.66665C5.46665 6.3584 6.12498 7.01673 6.12498 7.81673V15.0001C6.12498 15.8001 5.46665 16.4584 4.66665 16.4584ZM3.33333 7.60006C3.21667 7.60006 3.125 7.69172 3.125 7.80839V15.0001C3.125 15.1167 3.21667 15.2084 3.33333 15.2084H4.66665C4.78331 15.2084 4.87498 15.1167 4.87498 15.0001V7.81673C4.87498 7.70007 4.78331 7.6084 4.66665 7.6084H3.33333V7.60006Z"
                fill={getFillColor("forecast")}
              />
              <path
                d="M10.6666 16.4583H9.33333C8.53333 16.4583 7.875 15.7999 7.875 14.9999V5.15828C7.875 4.35828 8.53333 3.69995 9.33333 3.69995H10.6666C11.4666 3.69995 12.125 4.35828 12.125 5.15828V14.9999C12.125 15.7999 11.4666 16.4583 10.6666 16.4583ZM9.33333 4.94995C9.21667 4.94995 9.125 5.04162 9.125 5.15828V14.9999C9.125 15.1166 9.21667 15.2083 9.33333 15.2083H10.6666C10.7833 15.2083 10.875 15.1166 10.875 14.9999V5.15828C10.875 5.04162 10.7833 4.94995 10.6666 4.94995H9.33333Z"
                fill={getFillColor("forecast")}
              />
              <path
                d="M16.6666 16.4583H15.3333C14.5333 16.4583 13.875 15.8 13.875 15V2.49996C13.875 1.69996 14.5333 1.04163 15.3333 1.04163H16.6666C17.4666 1.04163 18.125 1.69996 18.125 2.49996V15C18.125 15.8 17.4666 16.4583 16.6666 16.4583ZM15.3333 2.29163C15.2167 2.29163 15.125 2.38329 15.125 2.49996V15C15.125 15.1166 15.2167 15.2083 15.3333 15.2083H16.6666C16.7833 15.2083 16.875 15.1166 16.875 15V2.49996C16.875 2.38329 16.7833 2.29163 16.6666 2.29163H15.3333Z"
                fill={getFillColor("forecast")}
              />
            </svg>
            <span>Прогноз</span>
          </Link>
        </li>
        <li
          className={styles.menu__item}
          onClick={() => setActiveItem("limit")}
        >
          <Link to="/limit" style={{ display: "flex" }}>
            <svg
              width="21"
              height="21"
              viewBox="0 0 21 21"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10.49 20.5072C16.0128 20.5072 20.49 16.03 20.49 10.5072C20.49 4.98432 16.0128 0.507172 10.49 0.507172C4.96714 0.507172 0.48999 4.98432 0.48999 10.5072C0.48999 16.03 4.96714 20.5072 10.49 20.5072Z"
                stroke={getFillColor("limit")}
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M10.49 15.5072V16.4972"
                stroke={getFillColor("limit")}
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M10.49 12.5072V4.50717"
                stroke={getFillColor("limit")}
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>

            <span>Лимит</span>
          </Link>
        </li>
        {/* <li
          className={styles.menu__item}
          onClick={() => setActiveItem("statistic")}
        >
          <Link to="/export" style={{ display: "flex" }}>
            <svg
              width="21"
              height="18"
              viewBox="0 0 21 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M15.2603 4.96271V7.99527L20.2761 3.97948L15.2603 -0.00106812V2.96271H13.1804H12.7662L12.4733 3.2556L3.2623 12.4666H0.28125V14.4666H3.67651H4.09073L4.38362 14.1737L13.5946 4.96271H15.2603Z"
                fill={getFillColor("statistic")}
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M15.2603 12.1986V9.16608L20.2761 13.1819L15.2603 17.1624V14.1986H13.1804H12.7662L12.4733 13.9057L3.2623 4.69472H0.28125V2.69472H3.67651H4.09073L4.38362 2.98761L13.5946 12.1986H15.2603Z"
                fill={getFillColor("statistic")}
              />
            </svg>

            <span>Экспорт</span>
          </Link>
        </li> */}
      </ul>

      <button
        type="button"
        onClick={toggleTheme}
        className={styles.themeToggle}
        aria-label="Переключить тему"
        title={theme === "light" ? "Включить тёмную тему" : "Включить светлую тему"}
      >
        {theme === "light" ? "🌙 Тёмная тема" : "☀️ Светлая тема"}
      </button>

      <LoginButton />
      <div className={styles.profie__wrapper}>
        <Profile />
        <LogoutButton />
      </div>
    </div>
  );
}

export default Side;
