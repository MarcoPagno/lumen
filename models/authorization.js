function can(user, feature) {
  let authorizhed = false;

  if (user.features.includes(feature)) {
    authorizhed = true;
  }

  return authorizhed;
}

const authorizationModel = {
  can,
};

export default authorizationModel;
