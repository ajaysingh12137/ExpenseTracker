import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Inbox: undefined;
  Overview: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  EditTransaction: { id: number };
  AddTransaction: { voice?: boolean } | undefined;
  CategoryTransactions: {
    categoryId: string;
    name: string;
    year: number;
    month: number;
  };
  CaptureSources: undefined;
  BatteryGuide: undefined;
};
