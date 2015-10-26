/*
 * Copyright (c) 2014 Juniper Networks, Inc. All rights reserved.
 */

define([
    'underscore'
], function (_) {
    var CTParsers = function() {
        var self = this;

        this.alarmDataParser = function(response) {
           var retArr = [];
           if(response != null && _.keys(response).length > 0) {
                for(var currNodeType in response) {
                    for(var i=0;i<response[currNodeType].length;i++) {
                        var currItem = response[currNodeType][i];
                        var currObject = {};
                        currObject.name = currItem.name + ' (' + currNodeType + ')';
                        if(currItem.value != null && currItem.value.UVEAlarms != null && currItem.value.UVEAlarms.alarms != null
                            && currItem.value.UVEAlarms.alarms.length > 0) {
                            var alertInfo = currItem.value.UVEAlarms.alarms[0];
                            currObject.type = alertInfo.type;
                            currObject.ack = alertInfo.ack;
                            currObject.status = ((alertInfo.ack == null) || (alertInfo.ack == false)) ? 'Unacknowledged' : 'Acknowledged';
                            currObject.timestamp = getFormattedDate(alertInfo.timestamp/1000);
                            currObject.severity = alertInfo.severity;
                            currObject.description = alertInfo.description;
                            currObject.token = alertInfo.token;
                            retArr.push(currObject);
                        }
                    }
                }
           }
           return retArr;
        };

        this.instanceInterfaceDataParser = function(response) {
            var rawInterfaces, interface, interfaceMap = {}, uveVMInterfaceAgent;
            if(response != null && response.value != null) {
                rawInterfaces = response.value;
                for(var i = 0; i < rawInterfaces.length; i++) {
                    interface = {};
                    uveVMInterfaceAgent = rawInterfaces[i]['value']['UveVMInterfaceAgent'];
                    interface = $.extend(true, interface, uveVMInterfaceAgent);
                    interface['name'] = rawInterfaces[i]['name'];

                    var ip6Active = interface['ip6_active'];
                    if(ip6Active) {
                        interface['ip'] = interface['ip6_address'];
                    } else {
                        interface['ip'] = interface['ip_address'];
                    }

                    var fipStatsList = getValueByJsonPath(uveVMInterfaceAgent, 'fip_diff_stats'),
                        floatingIPs = (fipStatsList == null) ? [] : fipStatsList;

                    interface['floatingIP'] = [];
                    $.each(floatingIPs, function (idx, fipObj) {
                        interface['floatingIP'].push(contrail.format('{0} ({1} / {2})', fipObj['ip_address'], cowu.addUnits2Bytes(ifNull(fipObj['in_bytes'], '-')), cowu.addUnits2Bytes(ifNull(fipObj['out_bytes'], '-'))));
                    });

                    if(contrail.checkIfExist(interface['if_stats'])) {
                        interface['throughput'] = interface['in_bw_usage'] + interface['out_bw_usage'];
                    }

                    interfaceMap[interface['name']] = interface;
                }
            }
            return interfaceMap;
        };

        this.parseNetworks4PortMap = function (data) {
            var response = data['res'];
            var result = {};
            var value = 0;
            var portMap = [0, 0, 0, 0, 0, 0, 0, 0];

            //If portmap received from multiple vRouters
            if ((response instanceof Array) && (response[0] instanceof Array)) {
                $.each(response, function (idx, obj) {
                    for (var i = 0; i < 8; i++) {
                        portMap[i] |= parseInt(obj[0][i]);
                    }
                });
            } else if (response instanceof Array)
                portMap = response;
            if (portMap != null) {
                var strPortMap = [];
                $.each(portMap, function (idx, value) {
                    var str = get32binary(parseInt(value)),
                        reverseString = str.split("").reverse().join("");

                    strPortMap.push(reverseString);
                });
                //console.info(strPortMap);
            }
            //To plot in 4 rows
            var stringPortMap = [];
            for (var i = 0, j = 0; j < 4; i += 2, j++)
                stringPortMap[j] = strPortMap[i] + strPortMap[i + 1]
            var chartData = [];
            for (var i = 0; i < 64; i++) {
                for (var j = 0; j < 4; j++) {
                    chartData.push({
                        x: i,
                        y: j,
                        value: (response == null) ? 0 : parseInt(stringPortMap[j][i])
                    });
                }
            }
            result['res'] = chartData;
            result['type'] = data['type'];
            result['pType'] = data['pType'];
            return result;
        };

        this.parseTrafficLineChartData = function (responseArray) {
            if (responseArray.length == 0) {
                return [];
            }
            var response = responseArray[0],
                rawdata = response['flow-series'],
                inBytes = {key: "In Traffic", values: [], color: d3_category5[0]},
                outBytes = {key: "Out Traffic", values: [], color: d3_category5[1]},
                inPackets = {key: "In Packets", values: []}, outPackets = {key: "Out Packets", values: []},
                chartData = [inBytes, outBytes];

            for (var i = 0; i < rawdata.length; i++) {
                var ts = Math.floor(rawdata[i].time / 1000);
                inBytes.values.push({x: ts, y: rawdata[i].inBytes});
                outBytes.values.push({x: ts, y: rawdata[i].outBytes});
                inPackets.values.push({x: ts, y: rawdata[i].inPkts});
                outPackets.values.push({x: ts, y: rawdata[i].outPkts});
            }
            return chartData;
        };

        this.parseCPUMemLineChartData = function(responseArray) {
            var cpuUtilization = {key: "CPU Utilization (%)", values: [], bar: true, color: d3_category5[1]},
                memoryUsage = {key: "Memory Usage", values: [], color: d3_category5[3]},
                chartData = [memoryUsage, cpuUtilization];

            for (var i = 0; i < responseArray.length; i++) {
                var ts = Math.floor(responseArray[i]['T'] / 1000);
                cpuUtilization.values.push({x: ts, y: responseArray[i]['cpu_stats.cpu_one_min_avg']});
                memoryUsage.values.push({x: ts, y: responseArray[i]['cpu_stats.rss']});
            }
            return chartData;
        };

        this.parseCPUMemLineChartDataForNodeDetails = function(responseArray,options) {
            var cpuUtilization = {key: "CPU Utilization (%)", values: [], bar: true, color: d3_category5[1]},
                memoryUsage = {key: "Memory Usage", values: [], color: d3_category5[3]},
                chartData = [memoryUsage, cpuUtilization];

            for (var i = 0; i < responseArray.length; i++) {
                var ts = Math.floor(responseArray[i]['T'] / 1000);
                cpuUtilization.values.push({x: ts, y: responseArray[i][options.dimensions[0]]});
                memoryUsage.values.push({x: ts, y: responseArray[i][options.dimensions[1]]});
            }
            return chartData;
        };

        this.parseDataForNodeDetailsSparkline = function (responseArray,options) {
            var retData = [];
            for (var i = 0; i < responseArray.length; i++) {
//                var ts = Math.floor(responseArray[i]['T'] / 1000);
                retData.push(responseArray[i][options.dimensions[0]]);
            }
            return retData;
        }

        this.parseNetwork4Breadcrumb = function(response) {
            return  $.map(response['virtual-networks'], function (n, i) {
                if (!ctwu.isServiceVN(n.fq_name.join(':'))) {
                    return {
                        fq_name: n.fq_name.join(':'),
                        name: n.fq_name[2],
                        value: n.uuid
                    };
                }
            });
        };

        this.vRouterCfgDataParser = function(response) {
           var retArr = [];
           if(response != null &&
              'virtual-routers' in response &&
               response['virtual-routers'] != null &&
               response['virtual-routers'].length > 0) {
               var length = response['virtual-routers'].length
               for (var i = 0; i < length; i++) {
                   retArr.push(response['virtual-routers'][i]['virtual-router']);
               }
           }
           return retArr;
        };

        this.ipamCfgDataParser = function(response) {
           var retArr = [];
           if(response != null &&
              'network-ipams' in response &&
               response['network-ipams'] != null &&
               response['network-ipams'].length > 0) {
               var length = response['network-ipams'].length
               for (var i = 0; i < length; i++) {
                   retArr.push(response['network-ipams'][i]['network-ipam']);
               }
           }
           return retArr;
        };

        this.fipCfgDataParser = function(response) {
           var retArr = [];
           if(response != null &&
              'floating_ip_back_refs' in response &&
               response['floating_ip_back_refs'] != null &&
               response['floating_ip_back_refs'].length > 0) {
               var length = response['floating_ip_back_refs'].length
               for (var i = 0; i < length; i++) {
                   retArr.push(response['floating_ip_back_refs'][i]['floating-ip']);
               }
           }
           return retArr;
        };

        this.svcTemplateCfgDataParser = function(response) {
           var retArr = [];
           if(response != null &&
              'service_templates' in response &&
               response['service_templates'] != null &&
               response['service_templates'].length > 0) {
               var length = response['service_templates'].length
               for (var i = 0; i < length; i++) {
                   retArr.push(response['service_templates'][i]['service-template']);
               }
           }
           return retArr;
        };
        
        this.vmTrafficStatsParser = function (response) {
            return [response];
        };

        this.interfaceDataParser = function(response) {
            var interfaceMap = self.instanceInterfaceDataParser(response)
            return _.values(interfaceMap);
        };
        
        this.parseInstanceInterfaceStats = function (response) {
            var retArr = $.map(ifNull(response['value'], response), function (obj, idx) {
                var item = {};
                var props = ctwc.STATS_SELECT_FIELDS['virtual-machine'];
                item['name'] = obj['name'];
                item['inBytes'] = ifNull(obj[props['inBytes']], '-');
                item['outBytes'] = ifNull(obj[props['outBytes']], '-');
                return item;
            });
            return retArr;
        };
        
        this.parseNetwork4PortDistribution = function(response, networkFQN, interfaceIP) {
            var srcPortdata  = response ? ctwp.parsePortDistribution(ifNull(response['sport'], []), {
                    startTime: response['startTime'],
                    endTime: response['endTime'],
                    bandwidthField: 'outBytes',
                    flowCntField: 'outFlowCount',
                    portField: 'sport',
                    portYype: "src",
                    fqName: networkFQN,
                    ipAddress: interfaceIP
                }) : [],
                dstPortData = response ? ctwp.parsePortDistribution(ifNull(response['dport'], []), {
                    startTime: response['startTime'],
                    endTime: response['endTime'],
                    bandwidthField: 'inBytes',
                    flowCntField: 'inFlowCount',
                    portField: 'dport',
                    portYype: "src",
                    fqName: networkFQN,
                    ipAddress: interfaceIP
                }) : [],
                chartData = [];

            chartData = chartData.concat(srcPortdata);
            chartData = chartData.concat(dstPortData);

            return chartData;
        };
        

        this.parsePortDistribution = function (responseData, parserConfig) {
            var portCF = crossfilter(responseData),
                portField = ifNull(parserConfig['portField'], 'sport'),
                portType = parserConfig['portType'],
                color, parsedData = [],
                fqName = parserConfig['fqName'];

            if (portType == null) {
                portType = (portField == 'sport') ? 'src' : 'dst';
            }

            var flowCntField = ifNull(parserConfig['flowCntField'], 'outFlowCnt'),
                bandwidthField = ifNull(parserConfig['bandwidthField'], 'outBytes');

            var portDim = portCF.dimension(function (d) {
                    return d[parserConfig['portField']];
                }),
                PORT_LIMIT = 65536, PORT_STEP = 256,
                startPort = ifNull(parserConfig['startPort'], 0),
                endPort = ifNull(parserConfig['endPort'], PORT_LIMIT);

            if (endPort - startPort == 255)
                PORT_STEP = 1;

            if (portType == 'src') {
                color = 'default';
            } else {
                color = 'medium';
            }

            //Have a fixed port bucket range of 256
            for (var i = startPort; i <= endPort; i = i + PORT_STEP) {
                var name, range,
                    totalBytes = 0, flowCnt = 0, x;

                if (PORT_STEP == 1) {
                    portDim.filter(i);
                    name = i;
                    range = i;
                } else {
                    portDim.filter([i, Math.min(i + PORT_STEP - 1, 65536)]);
                    name = i + ' - ' + Math.min(i + PORT_STEP - 1, 65536);
                    range = i + '-' + Math.min(i + PORT_STEP - 1, 65536);
                }

                $.each(portDim.top(Infinity), function (idx, obj) {
                    totalBytes += obj[bandwidthField];
                    flowCnt += obj[flowCntField];
                });

                x = Math.floor(i + Math.min(i + PORT_STEP - 1, 65536)) / 2

                if (portDim.top(Infinity).length > 0)
                    parsedData.push({
                        startTime: parserConfig['startTime'],
                        endTime: parserConfig['endTime'],
                        x: x,
                        y: totalBytes,
                        name: name,
                        type: portType == 'src' ? 'sport' : 'dport',
                        range: range,
                        flowCnt: flowCnt,
                        size: flowCnt,
                        color: color,
                        fqName: fqName,
                        ipAddress: parserConfig['ipAddress']
                        //type:portField
                    });
            }
            return parsedData;
        };
    };

    return CTParsers;
});
