type GouterConfig = {
  App: {};
  LoginStack: {};
  Login: {
    name: string;
  };
  LoginModal: {};
  LoginConfirmationStack: {};
  LoginConfirmation: {phone: string};
  LoginDrawer: {};
  Tabs: {};
  Home: {};
  Post: {};
  Profile: {};
};

type GouterState<T extends keyof GouterConfig = keyof GouterConfig> =
  import('gouter').State<GouterConfig, T>;

type GouterScreen = ScreenMap<State>;
