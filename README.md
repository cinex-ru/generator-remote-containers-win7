# Generator for vscode remote containers

For all those who use docker-cli on windows 7 together with docker-machine and VirtualBox. This generator allows you to create a workspace to share with awesome [vscode remote containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).

## Prerequisites

- [docker-cli](https://github.com/docker/cli)
- [docker-machine](https://github.com/docker/machine)
- git, Oracle VM VirtualBox, MS Windows 7, etc ..

## Install

``` bash
npm -g generator-remote-containers-win7
```

``` bash
yarn global add generator-remote-containers-win7
```

## Usage

run
  
``` bash
yo remote-containers-win7
```

select virtual machine

![select virtual machine](https://raw.githubusercontent.com/cinex-ru/generator-remote-containers-win7/master/images/select-vm.png)

select container template from [vscode-dev-containers](https://github.com/microsoft/vscode-dev-containers)

![select container template](https://raw.githubusercontent.com/cinex-ru/generator-remote-containers-win7/master/images/select-container-template.png)

enter application name and folder

![enter application name and folder](https://raw.githubusercontent.com/cinex-ru/generator-remote-containers-win7/master/images/appname-and-folder.png)

after generator will finish, navigate to the created folder and run script before start vscode

![select container template](https://raw.githubusercontent.com/cinex-ru/generator-remote-containers-win7/master/images/run-script.png)

start vscode

``` bash
code .
```
