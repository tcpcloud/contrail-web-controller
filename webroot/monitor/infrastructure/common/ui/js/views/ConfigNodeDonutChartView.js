/*
 * Copyright (c) 2015 Juniper Networks, Inc. All rights reserved.
 */

define(['underscore', 'contrail-view'],function(_, ContrailView){
    var ConfigNodeDonutChartView = ContrailView.extend({
        render : function (){
            var self = this,
                viewConfig = self.attributes.viewConfig;
            this.renderView4Config(this.$el, this.model,
                    getConfigNodeDonutChartViewConfig(ifNull(viewConfig.colorMap, {})), null, null, null, function () {
                if (viewConfig['widgetConfig'] != null) {
                    self.renderView4Config($(self.$el).find('.section-content'), self.model, viewConfig['widgetConfig'], null, null, null);
                }
            });
        }
    });

    function getConfigNodeDonutChartViewConfig (colorMap) {
        return {
            elementId: ctwl.CONFIGNODE_SUMMARY_DONUTCHART_SECTION_ID,
            view: 'SectionView',
            viewConfig: {
                rows:[{
                    columns: [{
                        elementId: ctwl.CONFIGNODE_SUMMARY_DONUTCHART_ONE_ID,
                        view: 'DonutChartView',
                        viewConfig: {
                            class: 'col-xs-6',
                            parseFn: function (response) {
                                return monitorInfraParsers
                                    .parseConfigNodeRequestForDonutChart(
                                         response, ['GET'], colorMap);
                            },
                            chartOptions: {
                                height: 170,
                                margin: {
                                    top: 10,
                                    bottom: 10
                                },
                                showLabels: false,
                                showLegend: false,
                                title: 'Reads',
                                defaultDataStatusMessage: false,
                                showEmptyDonut: true
                            },
                        }
                    }, {
                        elementId: ctwl.CONFIGNODE_SUMMARY_DONUTCHART_TWO_ID,
                        view: 'DonutChartView',
                        viewConfig: {
                            class: 'col-xs-6',
                            parseFn: function (response) {
                                return monitorInfraParsers
                                    .parseConfigNodeRequestForDonutChart(
                                         response, ['POST', 'PUT', 'DELETE'], colorMap);
                            },
                            chartOptions: {
                                height: 170,
                                margin: {
                                    bottom: 10,
                                    top: 10
                                },
                                showLabels: false,
                                title: 'Writes',
                                defaultDataStatusMessage: false,
                                showEmptyDonut: true
                            },
                        }
                    }]
                }]
            }
        }
    }
    return ConfigNodeDonutChartView;
});
