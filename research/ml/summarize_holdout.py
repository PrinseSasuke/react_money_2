"""Summarise grouped attack holdout experiments without treating windows as independent."""
import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from holdout_models import OUT


def main():
    metrics=pd.DataFrame(json.loads((OUT/'metrics.json').read_text(encoding='utf8')))
    metrics['attack_precision']=metrics.confusion.map(
        lambda c: c[2][2]/max(1,c[0][2]+c[1][2]+c[2][2]))
    per=metrics.groupby(['holdout','model','split'],as_index=False)[
        ['attack_recall','attack_precision','fault_as_attack','norm_as_attack']].mean()
    summary=per.groupby(['holdout','model']).agg(
        recall_mean=('attack_recall','mean'),recall_sd=('attack_recall','std'),
        precision_mean=('attack_precision','mean'),precision_sd=('attack_precision','std'),
        fault_as_attack_mean=('fault_as_attack','mean'),norm_as_attack_mean=('norm_as_attack','mean'),
        splits=('split','nunique')).reset_index()
    summary.to_csv(OUT/'summary.csv',index=False)
    groups=list(summary.holdout.drop_duplicates());x=np.arange(len(groups));width=.24
    fig,ax=plt.subplots(figsize=(11,4.8))
    for i,model in enumerate(['rf','mlp','transformer']):
        s=summary[summary.model==model].set_index('holdout').reindex(groups)
        ax.bar(x+(i-1)*width,s.recall_mean,width,yerr=s.recall_sd.fillna(0),capsize=2,label=model)
    ax.set_xticks(x,groups,rotation=35,ha='right');ax.set_ylabel('Recall исключённой атаки')
    ax.set_ylim(0,1.15);ax.grid(axis='y',alpha=.25);ax.legend();fig.tight_layout()
    fig.savefig(OUT/'unseen_recall.png',dpi=160);plt.close(fig)
    lines=['# Исключение сценариев и семейств атак','',
      '> Исследовательская оценка на исторических данных: отсутствуют времена отдельных отсчётов и подтверждение инъекции; '
      'дополнительный минутный lookback здесь не учитывался. Использовать как ограниченный результат, не как оценку новых реальных атак.','',
      'Исключённый сценарий или семейство отсутствует в train и validation. Test включает его атакующие окна '
      'и независимые тестовые окна нормальной работы и сбоев. Показаны среднее ± std по пяти групповым разделениям '
      'после усреднения трёх seed внутри разделения. Разбиения могут использовать одни и те же прогоны.', '',
      '| Исключено | Random Forest | MLP | Transformer |','|---|---:|---:|---:|']
    for group in groups:
        values=[]
        for model in ['rf','mlp','transformer']:
            row=summary[(summary.holdout==group)&(summary.model==model)].iloc[0]
            values.append(f'{row.recall_mean:.3f} ± {row.recall_sd:.3f}')
        lines.append(f'| {group} | '+' | '.join(values)+' |')
    lines += ['', '![Recall исключённых атак](holdout_results/unseen_recall.png)', '',
      'Precision класса атаки и доли `fault → attack` и `norm → attack` доступны в `holdout_results/summary.csv`; '
      'при отсутствии предсказаний класса атаки precision считается равной нулю. '
      'Матрицы, время работы и все предсказания — в `metrics.json` и `predictions.csv.gz`. '
      'Обучение только на других синтетических сценариях не гарантирует перенос на произвольные реальные атаки.']
    (OUT.parent/'HOLDOUT_RESULTS.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
    print(summary.to_string(index=False))


if __name__=='__main__':main()
