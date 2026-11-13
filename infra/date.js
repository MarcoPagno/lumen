const DEFAULT_TIMEZONE = "America/Sao_Paulo";

function getTimezone() {
  return process.env.APP_TIMEZONE || DEFAULT_TIMEZONE;
}

function toLocalDateOnlyString(date, timeZone = getTimezone()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getTodayDateOnly() {
  return toLocalDateOnlyString(new Date());
}

const date = {
  getTimezone,
  toLocalDateOnlyString,
  getTodayDateOnly,
};

export default date;
