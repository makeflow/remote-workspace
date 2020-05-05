import {PageHeader} from 'antd';
import {RouteComponentProps} from 'boring-router-react';
import {computed, observable, runInAction} from 'mobx';
import {observer} from 'mobx-react';
import React, {Component, ReactNode} from 'react';
import {Dict} from 'tslang';

import {CreateWorkspaceOptions, RawTemplatesConfig} from '../../../bld/shared';
import {VersionInfo, WorkspaceForm} from '../@components';
import {WorkspaceRoute, route} from '../@routes';

export interface CreateViewProps
  extends RouteComponentProps<WorkspaceRoute['create']> {
  className?: string;
}

@observer
export class CreateView extends Component<CreateViewProps> {
  @observable
  private templates: RawTemplatesConfig = {};

  @observable
  private formKey = 0;

  @computed
  private get defaultWorkspaceName(): string | undefined {
    let {match} = this.props;
    return match.$params.template;
  }

  @computed
  private get defaultParams(): Dict<string> | undefined {
    let {match} = this.props;

    let paramsString = match.$params.params;

    if (!paramsString) {
      return undefined;
    }

    return paramsString.split('&').reduce<Dict<string>>((dict, param) => {
      let equalIndex = param.indexOf('=');

      if (equalIndex < 0) {
        dict[param] = '';
      } else {
        dict[param.slice(0, equalIndex)] = param.slice(equalIndex + 1);
      }

      return dict;
    }, {});
  }

  render(): ReactNode {
    let defaultParams = this.defaultParams;
    let defaultWorkspaceName = this.defaultWorkspaceName;

    return (
      <div>
        <VersionInfo />
        <PageHeader title="Create Workspace" />
        <div className="section-content">
          <WorkspaceForm
            key={this.formKey}
            templates={this.templates}
            workspace={undefined}
            defaultParams={defaultParams}
            defaultWorkspaceName={defaultWorkspaceName}
            onSubmitSuccess={this.onWorkspaceFormSubmitSuccess}
          />
        </div>
      </div>
    );
  }

  componentDidMount(): void {
    this.loadTemplates().catch(console.error);
  }

  private onWorkspaceFormSubmitSuccess = (
    data: CreateWorkspaceOptions,
  ): void => {
    this.formKey++;

    route.list.$push({search: data.displayName});
  };

  private async loadTemplates(): Promise<void> {
    let response = await fetch('/api/templates');
    let {data} = (await response.json()) as {
      data?: RawTemplatesConfig;
    };

    if (data) {
      runInAction(() => {
        this.templates = data!;
      });
    }
  }
}
