function normalizeSqlParams(params, userId) {
  if (!Array.isArray(params)) {
    return [];
  }

  return params.map((value) => (value === "user_id" ? userId : value));
}

module.exports = {
  normalizeSqlParams,
};
